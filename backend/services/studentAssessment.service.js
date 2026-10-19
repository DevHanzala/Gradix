import { withTransaction } from "../DB/db.js";
import { generateAssessmentQuestions } from "../models/assessmentModel.js";
import * as attemptRepo from "../repositories/attemptRepository.js";
import { AppError } from "../utils/AppError.js";
import { availableLanguages } from "./assessmentAvailability.js";
import { findLanguageStatesQuery, incrementServedQuery } from "../repositories/poolRepository.js";
import { selectPoolQuestion, otherStudentSets, topUpIfLow, languageBuckets, isLanguageReady } from "./pool/pool.service.js";
import {
  gradeAnswer,
  canonicalStudentAnswer,
  normalizeOptions,
  decodeStoredValue,
} from "../utils/grading.js";

/** Network/clock tolerance applied to every time window. */
export const GRACE_MS = 2000;
export const SUPPORTED_LANGUAGES = ["en", "ur", "ar", "fa"];

// ------------------------------------------------------------------ timing

const durationsOf = (questions) => questions.map((q) => Number(q.duration_per_question) || 0);

/**
 * Server-side view of where the student is allowed to be right now.
 * Questions are strictly sequential: a question's window starts when the
 * previous one ends (or when the student advanced early) and lasts its
 * duration. Windows that have fully elapsed are skipped automatically, so
 * a student who goes offline cannot come back to an old question.
 */
export const computeTiming = (attempt, questions, now = Date.now()) => {
  const durations = durationsOf(questions);
  const count = questions.length;
  const totalSeconds = durations.reduce((a, b) => a + b, 0);
  const startedAt = new Date(attempt.started_at).getTime();
  const deadline = startedAt + totalSeconds * 1000;

  let index = Math.min(Number(attempt.current_question_index) || 0, count);
  let questionStart = new Date(attempt.current_question_started_at || attempt.started_at).getTime();

  while (index < count && now > questionStart + durations[index] * 1000 + GRACE_MS) {
    questionStart += durations[index] * 1000;
    index += 1;
  }

  const expired = index >= count || now > deadline + GRACE_MS;
  const clamp = (value, max) => Math.max(0, Math.min(max, value));
  const questionRemainingSeconds = expired
    ? 0
    : clamp(Math.ceil((questionStart + durations[index] * 1000 - now) / 1000), durations[index]);
  const laterSeconds = expired ? 0 : durations.slice(index + 1).reduce((a, b) => a + b, 0);
  const remainingSeconds = expired
    ? 0
    : clamp(Math.min(Math.ceil((deadline - now) / 1000), questionRemainingSeconds + laterSeconds), totalSeconds);

  return {
    index: Math.min(index, count),
    questionStart,
    expired,
    questionRemainingSeconds,
    remainingSeconds,
    totalSeconds,
    late: now > deadline + GRACE_MS,
  };
};

const timingChanged = (attempt, timing) =>
  Number(attempt.current_question_index) !== timing.index ||
  new Date(attempt.current_question_started_at || attempt.started_at).getTime() !== timing.questionStart;

// ------------------------------------------------------------- serializers

/** Questions as sent to a student during an attempt: never includes answers. */
const toPublicQuestion = (q) => ({
  id: q.id,
  question_order: q.question_order,
  question_type: q.question_type,
  question_text: q.question_text,
  options: q.question_type === "multiple_choice" ? normalizeOptions(q.options) : null,
  positive_marks: Number(q.positive_marks),
  negative_marks: Number(q.negative_marks),
  duration_per_question: Number(q.duration_per_question),
});

const buildInProgressState = (attempt, questions, savedRows, timing) => {
  const savedAnswers = {};
  for (const row of savedRows) {
    if (row.student_answer !== null && row.student_answer !== undefined) {
      savedAnswers[row.question_id] = row.student_answer;
    }
  }
  return {
    status: "in_progress",
    attemptId: attempt.id,
    assessmentId: attempt.assessment_id,
    language: attempt.language,
    startedAt: attempt.started_at,
    serverTime: new Date().toISOString(),
    totalDurationSeconds: timing.totalSeconds,
    remainingSeconds: timing.remainingSeconds,
    currentQuestionIndex: timing.index,
    questionRemainingSeconds: timing.questionRemainingSeconds,
    questions: questions.map(toPublicQuestion),
    savedAnswers,
  };
};

/** Full result of a completed attempt, including correct answers. */
export const buildAttemptResult = async (attempt, client) => {
  const questions = await attemptRepo.findAttemptQuestionsQuery(attempt.id, { includeAnswers: true }, client);
  const savedRows = await attemptRepo.findSavedAnswersQuery(attempt.id, client);
  const saved = new Map(savedRows.map((r) => [r.question_id, r.student_answer]));

  let totalMarks = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  const answers = questions.map((q) => {
    const studentAnswer = saved.get(q.id) ?? null;
    const { answered, correct, score } = gradeAnswer(q, studentAnswer);
    totalMarks += Number(q.positive_marks) || 0;
    if (!answered) unansweredCount += 1;
    else if (correct) correctCount += 1;
    else incorrectCount += 1;
    return {
      questionId: q.id,
      questionOrder: q.question_order,
      questionType: q.question_type,
      questionText: q.question_text,
      options: q.question_type === "multiple_choice" ? normalizeOptions(q.options) : null,
      studentAnswer,
      correctAnswer: decodeStoredValue(q.correct_answer),
      isCorrect: correct,
      answered,
      score,
      positiveMarks: Number(q.positive_marks),
      negativeMarks: Number(q.negative_marks),
    };
  });

  const score = Number(attempt.score) || 0;
  const startedAt = new Date(attempt.started_at).getTime();
  const completedAt = attempt.completed_at ? new Date(attempt.completed_at).getTime() : Date.now();

  return {
    status: "completed",
    attemptId: attempt.id,
    assessmentId: attempt.assessment_id,
    language: attempt.language,
    score,
    totalMarks,
    percentage: totalMarks > 0 ? Math.round((score / totalMarks) * 10000) / 100 : 0,
    correctCount,
    incorrectCount,
    unansweredCount,
    timeTakenSeconds: Math.max(0, Math.round((completedAt - startedAt) / 1000)),
    completedAt: attempt.completed_at,
    answers,
  };
};

// ---------------------------------------------------------------- finalize

/**
 * Grade every question from the saved answers and mark the attempt complete.
 * Idempotent: a second call on a completed attempt just returns its result.
 */
export const finalizeAttempt = async (attemptId) =>
  withTransaction(async (client) => {
    const attempt = await attemptRepo.findAttemptByIdQuery(attemptId, client, { forUpdate: true });
    if (!attempt) throw new AppError("ATTEMPT_NOT_FOUND", 404, "Attempt not found");
    if (attempt.status === "completed") return buildAttemptResult(attempt, client);

    const questions = await attemptRepo.findAttemptQuestionsQuery(attemptId, { includeAnswers: true }, client);
    const savedRows = await attemptRepo.findSavedAnswersQuery(attemptId, client);
    const saved = new Map(savedRows.map((r) => [r.question_id, r.student_answer]));

    let total = 0;
    for (const q of questions) {
      const studentAnswer = saved.get(q.id) ?? null;
      const { correct, score } = gradeAnswer(q, studentAnswer);
      total += score;
      await attemptRepo.saveGradeQuery(
        { attemptId, questionId: q.id, answer: studentAnswer, score, isCorrect: correct },
        client
      );
    }

    // A negative total is floored at zero (existing product rule).
    const completed = await attemptRepo.completeAttemptQuery(attemptId, Math.max(0, total), client);
    return buildAttemptResult(completed, client);
  });

// ------------------------------------------------------------------ helpers

const requireOwnedAttempt = async (studentId, attemptId, client) => {
  const id = Number.parseInt(attemptId, 10);
  if (!Number.isInteger(id)) throw new AppError("ATTEMPT_NOT_FOUND", 404, "Attempt not found");
  const attempt = await attemptRepo.findAttemptByIdQuery(id, client, { forUpdate: Boolean(client) });
  // Someone else's attempt is reported as "not found" to avoid leaking ids.
  if (!attempt || attempt.student_id !== studentId || attempt.is_physical_paper) {
    throw new AppError("ATTEMPT_NOT_FOUND", 404, "Attempt not found");
  }
  return attempt;
};

const loadInProgressState = async (attempt) => {
  const questions = await attemptRepo.findAttemptQuestionsQuery(attempt.id);
  const timing = computeTiming(attempt, questions);

  if (timing.expired) {
    return finalizeAttempt(attempt.id);
  }
  if (timingChanged(attempt, timing)) {
    await attemptRepo.updateAttemptTimingQuery(attempt.id, timing.index, new Date(timing.questionStart));
  }
  const savedRows = await attemptRepo.findSavedAnswersQuery(attempt.id);
  return buildInProgressState(attempt, questions, savedRows, timing);
};

const parseAssessmentId = (assessmentId) => {
  const id = Number.parseInt(assessmentId, 10);
  if (!Number.isInteger(id)) throw new AppError("ASSESSMENT_NOT_FOUND", 404, "Assessment not found");
  return id;
};

// ------------------------------------------------------- question sources

const unavailable = (code, message) => new AppError(code, 409, message);

/** Can a student take this assessment in this language right now? */
const assertAvailable = async (assessment, language) => {
  if (!["publishing", "published"].includes(assessment.status)) {
    throw unavailable("NOT_PUBLISHED", "This assessment has not been published yet.");
  }
  if (!assessment.blueprint?.slots?.length) return; // Phase 1 assessment (no objectives)
  if (!(assessment.languages || []).includes(language)) {
    throw new AppError("UNSUPPORTED_LANGUAGE", 400, "This assessment is not offered in that language.");
  }
  const state = (await findLanguageStatesQuery(assessment.id)).find((s) => s.language === language);
  if (state?.state !== "ready" && !isLanguageReady(await languageBuckets(assessment, language))) {
    throw unavailable("POOL_NOT_READY", "Questions in your language are still being prepared. Please try again in a few minutes.");
  }
};

/** One question per blueprint slot, from the pool (never the same question twice for a student). */
const selectFromPool = async (assessment, language) => {
  const slots = assessment.blueprint.slots;
  const servedIds = [];
  const otherSets = await otherStudentSets(assessment.id, language, null);
  const questions = [];
  for (const [i, slot] of slots.entries()) {
    const row = await selectPoolQuestion({
      assessment,
      language,
      bucket: { ...slot, difficulty: slot.difficulty || 3 },
      servedIds,
      isLast: i === slots.length - 1,
      otherSets,
    });
    if (!row) {
      await topUpIfLow(assessment, language);
      throw new AppError("POOL_EXHAUSTED", 503, "Your questions are being prepared. Please try again in a minute.");
    }
    servedIds.push(row.id);
    questions.push({
      question_type: row.question_type,
      question_text: row.question_text,
      options: row.options ? normalizeOptions(row.options) : null,
      correct_answer: decodeStoredValue(row.correct_answer),
      positive_marks: slot.positive_marks,
      negative_marks: slot.negative_marks,
      duration_per_question: slot.duration_per_question,
      objective_id: row.objective_id,
      difficulty: row.difficulty,
      language,
      source_chunk_ids: row.source_chunk_ids,
      stem_hash: row.stem_hash,
      pool_question_id: row.id,
    });
  }
  return { questions };
};

/** Phase 1 assessments without objectives: generate the set on the fly (unchanged behaviour). */
const generateLegacySet = async (assessment, language) => {
  try {
    return await generateAssessmentQuestions(assessment.id, language, assessment);
  } catch (error) {
    if (error.message === "NO_QUESTION_BLOCKS") {
      throw new AppError("NO_QUESTION_BLOCKS", 400, "This assessment has no questions configured yet");
    }
    console.error(`[START] question generation failed for assessment ${assessment.id}: ${error.message}`);
    throw new AppError("GENERATION_FAILED", 503, "Could not prepare your questions. Please try again.");
  }
};

// ------------------------------------------------------------- public API

/**
 * Current state of the student's attempt for an assessment:
 * not_started | in_progress (questions without answers) | completed (result).
 */
export const getAttemptStateService = async (studentId, assessmentId) => {
  const id = parseAssessmentId(assessmentId);
  const assessment = await attemptRepo.findAssessmentForStartQuery(id);
  if (!assessment) throw new AppError("ASSESSMENT_NOT_FOUND", 404, "Assessment not found");
  if (!(await attemptRepo.isStudentEnrolledQuery(studentId, id))) {
    throw new AppError("NOT_ENROLLED", 403, "You are not enrolled in this assessment");
  }

  const attempt = await attemptRepo.findOnlineAttemptQuery(studentId, id);
  if (!attempt) {
    const ready = (await findLanguageStatesQuery(id)).filter((st) => st.state === "ready").map((st) => st.language);
    return {
      status: "not_started",
      assessmentId: id,
      title: assessment.title,
      availableLanguages: availableLanguages({
        assessment_status: assessment.status,
        uses_pool: Boolean(assessment.blueprint),
        ready_languages: ready,
        languages: assessment.languages,
      }),
    };
  }
  if (attempt.status === "completed") return buildAttemptResult(attempt);
  return loadInProgressState(attempt);
};

/**
 * Start the student's single online attempt, or resume it if one is in
 * progress. Questions are generated BEFORE the attempt row is written, so
 * an LLM failure never leaves a stuck attempt behind.
 */
export const startAssessmentForStudentService = async (studentId, assessmentId, language = "en") => {
  const id = parseAssessmentId(assessmentId);
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    throw new AppError("UNSUPPORTED_LANGUAGE", 400, "Unsupported language");
  }

  const assessment = await attemptRepo.findAssessmentForStartQuery(id);
  if (!assessment) throw new AppError("ASSESSMENT_NOT_FOUND", 404, "Assessment not found");
  if (!(await attemptRepo.isStudentEnrolledQuery(studentId, id))) {
    throw new AppError("NOT_ENROLLED", 403, "You are not enrolled in this assessment");
  }

  const existing = await attemptRepo.findOnlineAttemptQuery(studentId, id);
  if (existing) {
    if (existing.status === "completed") {
      throw new AppError("ALREADY_ATTEMPTED", 409, "You have already completed this assessment");
    }
    const state = await loadInProgressState(existing);
    if (state.status === "completed") {
      throw new AppError("ALREADY_ATTEMPTED", 409, "Your time for this assessment has ended");
    }
    return { ...state, resumed: true, code: "IN_PROGRESS" };
  }

  await assertAvailable(assessment, language);
  const generated = assessment.blueprint?.slots?.length
    ? await selectFromPool(assessment, language)
    : await generateLegacySet(assessment, language);
  let attempt;
  try {
    attempt = await withTransaction(async (client) => {
      const created = await attemptRepo.insertAttemptQuery({ studentId, assessmentId: id, language }, client);
      let order = 1;
      for (const q of generated.questions) {
        await attemptRepo.insertGeneratedQuestionQuery(created.id, order, q, client);
        order += 1;
      }
      for (const q of generated.questions) {
        if (q.pool_question_id) await incrementServedQuery(q.pool_question_id, client);
      }
      // Only now, after enrollment was checked and the attempt exists.
      await attemptRepo.markAssessmentExecutedQuery(id, client);
      return created;
    });
  } catch (error) {
    if (error.code === "23505") {
      // A parallel Start created the attempt first: resume that one.
      const concurrent = await attemptRepo.findOnlineAttemptQuery(studentId, id);
      if (concurrent && concurrent.status === "in_progress") {
        return { ...(await loadInProgressState(concurrent)), resumed: true, code: "IN_PROGRESS" };
      }
      throw new AppError("ALREADY_ATTEMPTED", 409, "You have already completed this assessment");
    }
    throw error;
  }

  if (assessment.blueprint?.slots?.length) await topUpIfLow(assessment, language);
  return { ...(await loadInProgressState(attempt)), resumed: false };
};

/** Autosave one answer. Only the owner, only while in progress, only inside its time window. */
export const saveAnswerService = async (studentId, attemptId, questionId, answer) => {
  const qid = Number.parseInt(questionId, 10);

  const outcome = await withTransaction(async (client) => {
    const attempt = await requireOwnedAttempt(studentId, attemptId, client);
    if (attempt.status !== "in_progress") {
      throw new AppError("ATTEMPT_CLOSED", 409, "This attempt has already been submitted");
    }

    const questions = await attemptRepo.findAttemptQuestionsQuery(attempt.id, {}, client);
    const order = questions.findIndex((q) => q.id === qid);
    if (order === -1) throw new AppError("INVALID_QUESTION", 400, "Question does not belong to this attempt");

    const timing = computeTiming(attempt, questions);
    if (timing.expired) return { expired: true, attemptId: attempt.id };
    if (order < timing.index) {
      throw new AppError("QUESTION_CLOSED", 409, "Time for this question has ended");
    }

    let index = timing.index;
    let questionStart = timing.questionStart;
    if (order > index) {
      // The client moved ahead (e.g. an advance call was lost); follow it.
      index = order;
      questionStart = Date.now();
    }
    const storedStart = new Date(attempt.current_question_started_at || attempt.started_at).getTime();
    if (index !== Number(attempt.current_question_index) || questionStart !== storedStart) {
      await attemptRepo.updateAttemptTimingQuery(attempt.id, index, new Date(questionStart), client);
    }

    const stored = canonicalStudentAnswer(questions[order], answer);
    const row = await attemptRepo.upsertAnswerQuery({ attemptId: attempt.id, questionId: qid, answer: stored }, client);
    return { questionId: qid, savedAt: row.answered_at, currentQuestionIndex: index };
  });

  if (outcome.expired) {
    await finalizeAttempt(outcome.attemptId);
    throw new AppError("ATTEMPT_CLOSED", 409, "Time is up; your attempt has been submitted");
  }
  return outcome;
};

/** Move from `fromIndex` to the next question. Idempotent for repeated calls. */
export const advanceQuestionService = async (studentId, attemptId, fromIndex) => {
  const outcome = await withTransaction(async (client) => {
    const attempt = await requireOwnedAttempt(studentId, attemptId, client);
    if (attempt.status !== "in_progress") return { finished: true, attemptId: attempt.id };

    const questions = await attemptRepo.findAttemptQuestionsQuery(attempt.id, {}, client);
    const timing = computeTiming(attempt, questions);
    if (timing.expired) return { finished: true, attemptId: attempt.id };

    let index = timing.index;
    let questionStart = timing.questionStart;
    if (Number(fromIndex) === index) {
      index += 1;
      questionStart = Date.now();
    }
    if (index >= questions.length) return { finished: true, attemptId: attempt.id };

    await attemptRepo.updateAttemptTimingQuery(attempt.id, index, new Date(questionStart), client);
    const after = computeTiming(
      { ...attempt, current_question_index: index, current_question_started_at: new Date(questionStart) },
      questions
    );
    return {
      finished: false,
      currentQuestionIndex: after.index,
      questionRemainingSeconds: after.questionRemainingSeconds,
      remainingSeconds: after.remainingSeconds,
    };
  });

  if (outcome.finished) {
    return { finished: true, result: await finalizeAttempt(outcome.attemptId) };
  }
  return outcome;
};

/**
 * Submit the attempt. Answers in the payload are a final flush of anything
 * the autosave may not have delivered; they are accepted only for questions
 * whose time window is still open. Everything is graded from the DB.
 */
export const submitAssessmentForStudentService = async (studentId, assessmentId, attemptId, answers = []) => {
  const id = parseAssessmentId(assessmentId);
  let rejectedAnswers = 0;

  const attemptRowId = await withTransaction(async (client) => {
    const attempt = await requireOwnedAttempt(studentId, attemptId, client);
    if (attempt.assessment_id !== id) throw new AppError("ATTEMPT_NOT_FOUND", 404, "Attempt not found");
    if (attempt.status !== "in_progress") return attempt.id;

    const questions = await attemptRepo.findAttemptQuestionsQuery(attempt.id, {}, client);
    const timing = computeTiming(attempt, questions);
    const savedRows = await attemptRepo.findSavedAnswersQuery(attempt.id, client);
    const saved = new Map(savedRows.map((r) => [r.question_id, r.student_answer]));

    for (const item of Array.isArray(answers) ? answers : []) {
      const qid = Number.parseInt(item?.questionId, 10);
      const order = questions.findIndex((q) => q.id === qid);
      if (order === -1) continue;
      const stored = canonicalStudentAnswer(questions[order], item.answer);
      if (stored === null || stored === (saved.get(qid) ?? null)) continue;

      const windowOpen = !timing.expired && order >= timing.index;
      if (!windowOpen) {
        rejectedAnswers += 1;
        continue;
      }
      await attemptRepo.upsertAnswerQuery({ attemptId: attempt.id, questionId: qid, answer: stored }, client);
    }
    return attempt.id;
  });

  const result = await finalizeAttempt(attemptRowId);
  return { ...result, rejectedAnswers };
};

/** Review of a completed attempt (owner only). In-progress attempts are never exposed here. */
export const getSubmissionDetailsForStudentService = async (studentId, submissionId) => {
  const attempt = await requireOwnedAttempt(studentId, submissionId);
  if (attempt.status !== "completed") {
    throw new AppError("SUBMISSION_NOT_FOUND", 404, "Submission not found");
  }
  return buildAttemptResult(attempt);
};
