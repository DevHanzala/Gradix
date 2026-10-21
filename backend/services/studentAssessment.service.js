import { withTransaction } from "../DB/db.js";
import { generateAssessmentQuestions } from "../models/assessmentModel.js";
import * as attemptRepo from "../repositories/attemptRepository.js";
import { AppError } from "../utils/AppError.js";
import { availableLanguages } from "./assessmentAvailability.js";
import { notifyResultsReady } from "./lifecycleNotifications.js";
import { findLanguageStatesQuery, incrementServedQuery } from "../repositories/poolRepository.js";
import { selectPoolQuestion, otherStudentSets, topUpIfLow, languageBuckets, isLanguageReady } from "./pool/pool.service.js";
import { replayDifficulty, computeScores, ADAPTIVE_CONFIG } from "./engine/adaptiveConfig.js";
import {
  gradeAnswer,
  canonicalStudentAnswer,
  normalizeOptions,
  decodeStoredValue,
  isAnswered,
} from "../utils/grading.js";

/**
 * Exam engine (Phase 2).
 *
 * - Every attempt has a PLAN: one slot per question (objective, type, time,
 *   marks), copied from the assessment's blueprint when the attempt starts.
 * - The server serves ONE question at a time. For pool-backed assessments
 *   the question for a slot is chosen only when that slot opens, so the next
 *   question does not exist (anywhere) before it is served; with adaptive
 *   difficulty it depends on the answers so far.
 * - A question closes when the student moves on, when its time runs out, or
 *   at submit; it is graded at that moment (score, correctness, time taken).
 * - Difficulty is replayed from the graded history (engine/adaptiveConfig.js),
 *   so it is deterministic and survives restarts.
 * - The client never receives correctness unless the assessment has
 *   "show live score" enabled.
 */
export const GRACE_MS = 2000;
export const SUPPORTED_LANGUAGES = ["en", "ur", "ar", "fa"];
const MAX_SYNC_STEPS = 500;

// ------------------------------------------------------------------ timing

const durationsOf = (plan) => plan.map((s) => Number(s.duration_per_question) || 0);

/**
 * Where the student is allowed to be right now. Windows are sequential: a
 * question's window starts when it is served (or when the previous one
 * ended) and lasts its duration. Elapsed windows are skipped, so a student
 * who goes offline cannot come back to an old question. Time spent waiting
 * for a question to be prepared (serve_delay_ms) is added to the deadline.
 */
export const computeTiming = (attempt, plan, now = Date.now()) => {
  const durations = durationsOf(plan);
  const count = plan.length;
  const totalSeconds = durations.reduce((a, b) => a + b, 0);
  const startedAt = new Date(attempt.started_at).getTime();
  const deadline = startedAt + totalSeconds * 1000 + (Number(attempt.serve_delay_ms) || 0);

  let index = Math.min(Number(attempt.current_question_index) || 0, count);
  // A pending slot (next question not served yet) has not started: its window is still whole.
  let questionStart = attempt.current_question_started_at ? new Date(attempt.current_question_started_at).getTime() : now;
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

// ------------------------------------------------------------------- plan

/** Plan for a new attempt: blueprint slots, or the generated questions of a Phase 1 assessment. */
const planFromBlueprint = (blueprint) =>
  blueprint.slots.map((s) => ({
    objective_id: s.objective_id,
    question_type: s.question_type,
    num_options: s.num_options ?? null,
    difficulty: s.difficulty ?? null,
    duration_per_question: Number(s.duration_per_question),
    positive_marks: Number(s.positive_marks),
    negative_marks: Number(s.negative_marks),
  }));

const planFromQuestions = (questions) =>
  questions.map((q) => ({
    objective_id: q.objective_id ?? null,
    question_type: q.question_type,
    num_options: null,
    difficulty: q.difficulty ?? null,
    duration_per_question: Number(q.duration_per_question),
    positive_marks: Number(q.positive_marks),
    negative_marks: Number(q.negative_marks),
  }));

/** Attempts started before Phase 2 have no stored plan: derive it from their questions. */
const planOf = (attempt, questions) => attempt.plan || planFromQuestions(questions);

// ------------------------------------------------------------ serializers

/** A question as sent to a student during an attempt: never includes the answer. */
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

const liveScoreOf = (graded) => ({
  score: Math.round(graded.reduce((s, g) => s + g.score, 0) * 100) / 100,
  answered: graded.filter((g) => g.answered).length,
  correct: graded.filter((g) => g.correct).length,
});

const buildInProgressState = (ctx, timing) => {
  const { attempt, plan, saved, settings } = ctx;
  const current = ctx.slots[timing.index];
  const state = {
    status: "in_progress",
    attemptId: attempt.id,
    assessmentId: attempt.assessment_id,
    language: attempt.language,
    adaptive: Boolean(attempt.adaptive),
    startedAt: attempt.started_at,
    serverTime: new Date().toISOString(),
    totalQuestions: plan.length,
    totalDurationSeconds: timing.totalSeconds,
    remainingSeconds: timing.remainingSeconds,
    currentQuestionIndex: timing.index,
    questionRemainingSeconds: timing.questionRemainingSeconds,
    question: current ? toPublicQuestion(current) : null,
    savedAnswer: current ? (saved.get(current.id)?.student_answer ?? null) : null,
    showLiveScore: Boolean(settings.show_live_score),
  };
  if (settings.show_live_score) state.liveScore = liveScoreOf(gradedList(ctx));
  return state;
};

/** Graded questions so far, in order, with what scoring and adaptivity need. */
const gradedList = ({ questions, saved }) =>
  questions
    .filter((q) => saved.get(q.id)?.graded_at)
    .map((q) => {
      const row = saved.get(q.id);
      return {
        questionId: q.id,
        difficulty: q.difficulty,
        positiveMarks: Number(q.positive_marks),
        score: Number(row.score) || 0,
        correct: Boolean(row.is_correct),
        answered: isAnswered(row.student_answer),
        timedOut: Boolean(row.timed_out),
        timeTaken: Number(row.time_taken_seconds) || 0,
        timeAllowed: Number(q.duration_per_question) || 0,
      };
    });

// ---------------------------------------------------------------- loading

/** Question rows by slot (question_order - 1); slots never reached have none. */
const bySlot = (questions) => {
  const slots = [];
  for (const q of questions) slots[Number(q.question_order) - 1] = q;
  return slots;
};
const slotOf = (q) => Number(q.question_order) - 1;

const loadContext = async (attemptId, client) => {
  const attempt = await attemptRepo.findAttemptByIdQuery(attemptId, client, { forUpdate: Boolean(client) });
  const questions = await attemptRepo.findAttemptQuestionsQuery(attemptId, { includeAnswers: true }, client);
  const savedRows = await attemptRepo.findSavedAnswersQuery(attemptId, client);
  const settings = await attemptRepo.findAttemptSettingsQuery(attempt.assessment_id, client);
  return {
    attempt,
    plan: planOf(attempt, questions),
    questions,
    saved: new Map(savedRows.map((r) => [r.question_id, r])),
    settings,
    slots: bySlot(questions),
  };
};

// ---------------------------------------------------------------- grading

/**
 * Close one question: grade it and record time taken. Idempotent.
 * `windowStart` is when its window opened; `closedAt` when it closed.
 */
const gradeQuestion = async (client, ctx, question, { windowStart, closedAt, timedOut }) => {
  const row = ctx.saved.get(question.id);
  if (row?.graded_at) return;
  const answer = row?.student_answer ?? null;
  const { answered, correct, score } = gradeAnswer(question, answer);
  const duration = Number(question.duration_per_question) || 0;
  const answeredAt = row?.answered_at ? new Date(row.answered_at).getTime() : closedAt;
  const spent = ((answered ? answeredAt : closedAt) - windowStart) / 1000;
  const timeTaken = Math.max(0, Math.min(duration, spent));
  const graded = await attemptRepo.gradeAnswerQuery(
    {
      attemptId: ctx.attempt.id,
      questionId: question.id,
      answer,
      score,
      isCorrect: correct,
      timeTaken,
      timedOut: Boolean(timedOut) && !answered,
    },
    client
  );
  ctx.saved.set(question.id, graded);
};

// ---------------------------------------------------------------- serving

const currentDifficulty = (ctx, slotIndex) => {
  const slot = ctx.plan[slotIndex];
  if (!ctx.attempt.adaptive) return slot.difficulty || ADAPTIVE_CONFIG.START_DIFFICULTY;
  return replayDifficulty(gradedList(ctx)).next;
};

const questionFromPoolRow = (row, slot, language) => ({
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

const exhausted = () => new AppError("POOL_EXHAUSTED", 503, "Your next question is being prepared. Please try again in a moment.");

/** Choose a pool question for a slot (outside any transaction: may call the LLM). */
const chooseForSlot = async (assessment, ctx, slotIndex) => {
  const slot = ctx.plan[slotIndex];
  const row = await selectPoolQuestion({
    assessment,
    language: ctx.attempt.language,
    bucket: { ...slot, difficulty: currentDifficulty(ctx, slotIndex) },
    servedIds: ctx.questions.map((q) => q.pool_question_id).filter(Boolean),
    isLast: slotIndex === ctx.plan.length - 1,
    otherSets: await otherStudentSets(assessment.id, ctx.attempt.language, ctx.attempt.id),
  });
  if (!row) {
    await topUpIfLow(assessment, ctx.attempt.language);
    throw exhausted();
  }
  return questionFromPoolRow(row, slot, ctx.attempt.language);
};

/** Store the chosen question for a slot (no-op if another request served it first). */
const storeServed = async (client, attemptId, slotIndex, question, servedAt) => {
  const row = await attemptRepo.insertGeneratedQuestionQuery(attemptId, slotIndex + 1, { ...question, served_at: servedAt }, client);
  if (row && question.pool_question_id) await incrementServedQuery(question.pool_question_id, client);
  return row;
};

// ------------------------------------------------------------------ sync

/**
 * Bring an attempt up to date with the clock and return its state:
 *  - a pending slot (after the student moved on) is served now; its window
 *    starts when it is shown and the preparation time is not charged;
 *  - when the current window has elapsed the question is closed (timed out)
 *    and the attempt moves to the slot whose window is open now; slots whose
 *    windows passed while the student was away are "not reached";
 *  - when time is up everything is graded and the result returned.
 */
const syncAttempt = async (attemptId) => {
  for (let step = 0; step < MAX_SYNC_STEPS; step++) {
    const ctx = await loadContext(attemptId);
    const { attempt, plan, slots } = ctx;
    if (attempt.status === "completed") return buildAttemptResult(attempt);
    const index = Number(attempt.current_question_index) || 0;
    const timing = computeTiming(attempt, plan);
    const pending = !attempt.current_question_started_at;

    // 1. Serve the current slot if it has no question yet and its window is (or will be) open.
    if (index < plan.length && !slots[index] && !timing.expired && (pending || timing.index === index)) {
      const assessment = await attemptRepo.findAssessmentForStartQuery(attempt.assessment_id);
      const question = await chooseForSlot(assessment, ctx, index);
      await withTransaction(async (client) => {
        const locked = await attemptRepo.findAttemptByIdQuery(attemptId, client, { forUpdate: true });
        if (locked.status !== "in_progress" || Number(locked.current_question_index) !== index) return;
        const now = new Date();
        const servedAt = locked.current_question_started_at ? new Date(locked.current_question_started_at) : now;
        if (!(await storeServed(client, attemptId, index, question, servedAt))) return;
        // Waiting for a question to be prepared is not charged to the student.
        const previous = index > 0 ? ctx.saved.get(slots[index - 1]?.id)?.graded_at : null;
        const delay = locked.current_question_started_at || !previous ? 0 : Math.max(0, now.getTime() - new Date(previous).getTime());
        await attemptRepo.updateAttemptServingQuery(attemptId, { index, startedAt: servedAt, addDelayMs: delay, difficulty: question.difficulty }, client);
      });
      await topUpIfLow(assessment, attempt.language);
      continue;
    }

    if (!timing.expired && timing.index === index && slots[index]) {
      return buildInProgressState(ctx, timing);
    }

    // 2. The current window elapsed (or time is up): close it and move to the open window.
    const closed = await withTransaction(async (client) => {
      const locked = await loadContext(attemptId, client);
      if (locked.attempt.status !== "in_progress" || Number(locked.attempt.current_question_index) !== index) return false;
      const current = locked.slots[index];
      if (current) {
        const windowStart = new Date(attempt.current_question_started_at || attempt.started_at).getTime();
        const windowEnd = windowStart + Number(plan[index].duration_per_question) * 1000;
        await gradeQuestion(client, locked, current, { windowStart, closedAt: Math.min(windowEnd, Date.now()), timedOut: true });
      }
      if (!timing.expired) {
        await attemptRepo.updateAttemptServingQuery(
          attemptId,
          { index: timing.index, startedAt: new Date(timing.questionStart), addDelayMs: 0, difficulty: null },
          client
        );
      }
      return true;
    });
    if (timing.expired) return finalizeAttempt(attemptId, { expired: true });
    if (!closed) continue;
  }
  throw new Error(`Attempt ${attemptId} did not settle`);
};

// ---------------------------------------------------------------- finalize

/**
 * Grade every open question and mark the attempt complete. Slots that were
 * never reached count as unanswered (their marks still count in the total,
 * so submitting early never raises a percentage). Idempotent.
 */
export const finalizeAttempt = async (attemptId, options = {}) => {
  const { result, completed } = await completeAttempt(attemptId, options);
  // Only the call that actually completed the attempt notifies (after commit).
  if (completed) await notifyResultsReady(completed);
  return result;
};

const completeAttempt = async (attemptId, { expired = false } = {}) =>
  withTransaction(async (client) => {
    const ctx = await loadContext(attemptId, client);
    const { attempt, plan, questions } = ctx;
    if (!attempt) throw new AppError("ATTEMPT_NOT_FOUND", 404, "Attempt not found");
    if (attempt.status === "completed") return { result: await buildAttemptResult(attempt, client), completed: null };

    const now = Date.now();
    const currentStart = new Date(attempt.current_question_started_at || attempt.started_at).getTime();
    const index = Number(attempt.current_question_index) || 0;
    for (const q of questions) {
      const i = slotOf(q);
      const windowStart = i === index ? currentStart : now;
      const closedAt = i === index ? Math.min(now, currentStart + Number(q.duration_per_question) * 1000) : now;
      await gradeQuestion(client, ctx, q, { windowStart, closedAt, timedOut: expired });
    }

    const graded = gradedList(ctx);
    const unreached = plan.filter((_, i) => !ctx.slots[i]).map((slot) => ({
      positiveMarks: Number(slot.positive_marks),
      score: 0,
      correct: false,
      difficulty: null,
    }));
    const scores = computeScores([...graded, ...unreached]);
    const { path } = replayDifficulty(graded);
    const completed = await attemptRepo.completeAttemptQuery(
      attemptId,
      { ...scores, difficultyPath: attempt.adaptive ? path : null },
      client
    );
    return { result: await buildAttemptResult(completed, client), completed };
  });

/** Full result of a completed attempt, including correct answers (owner/instructor only). */
export const buildAttemptResult = async (attempt, client) => {
  const questions = await attemptRepo.findAttemptQuestionsQuery(attempt.id, { includeAnswers: true }, client);
  const savedRows = await attemptRepo.findSavedAnswersQuery(attempt.id, client);
  const saved = new Map(savedRows.map((r) => [r.question_id, r]));
  const plan = planOf(attempt, questions);

  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  const answers = questions.map((q) => {
    const row = saved.get(q.id);
    const studentAnswer = row?.student_answer ?? null;
    const { answered, correct, score } = gradeAnswer(q, studentAnswer);
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
      objectiveId: q.objective_id ?? null,
      difficulty: q.difficulty ?? null,
      timeTakenSeconds: row?.time_taken_seconds ?? null,
      timedOut: Boolean(row?.timed_out),
    };
  });
  const notReached = Math.max(0, plan.length - questions.length);
  unansweredCount += notReached;

  const totalMarks = plan.reduce((s, slot) => s + (Number(slot.positive_marks) || 0), 0);
  const score = Number(attempt.score) || 0;
  const startedAt = new Date(attempt.started_at).getTime();
  const completedAt = attempt.completed_at ? new Date(attempt.completed_at).getTime() : Date.now();

  return {
    status: "completed",
    attemptId: attempt.id,
    assessmentId: attempt.assessment_id,
    language: attempt.language,
    adaptive: Boolean(attempt.adaptive),
    score,
    totalMarks,
    percentage: totalMarks > 0 ? Math.round((score / totalMarks) * 10000) / 100 : 0,
    rawScore: attempt.raw_score ?? score,
    rawPercentage: attempt.raw_percentage ?? (totalMarks > 0 ? Math.round((score / totalMarks) * 10000) / 100 : 0),
    adjustedScore: attempt.adjusted_score ?? null,
    adjustedPercentage: attempt.adjusted_percentage ?? null,
    difficultyPath: attempt.difficulty_path ?? null,
    correctCount,
    incorrectCount,
    unansweredCount,
    notReachedCount: notReached,
    timeTakenSeconds: Math.max(0, Math.round((completedAt - startedAt) / 1000)),
    completedAt: attempt.completed_at,
    answers,
  };
};

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

const parseAssessmentId = (assessmentId) => {
  const id = Number.parseInt(assessmentId, 10);
  if (!Number.isInteger(id)) throw new AppError("ASSESSMENT_NOT_FOUND", 404, "Assessment not found");
  return id;
};

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

/** Phase 1 assessments without objectives: generate the whole set up front (revealed one at a time). */
const generateLegacySet = async (assessment, language) => {
  try {
    return (await generateAssessmentQuestions(assessment.id, language, assessment)).questions;
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
 * Current state of the student's attempt: not_started (with the languages
 * available now) | in_progress (current question only) | completed (result).
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
      adaptive: Boolean(assessment.adaptive),
      availableLanguages: availableLanguages({
        assessment_status: assessment.status,
        uses_pool: Boolean(assessment.blueprint),
        ready_languages: ready,
        languages: assessment.languages,
      }),
    };
  }
  if (attempt.status === "completed") return buildAttemptResult(attempt);
  return syncAttempt(attempt.id);
};

/**
 * Start the student's single online attempt (or resume it). The first
 * question is chosen BEFORE the attempt row is written, so a failure never
 * leaves a stuck attempt behind.
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
    const state = await syncAttempt(existing.id);
    if (state.status === "completed") {
      throw new AppError("ALREADY_ATTEMPTED", 409, "Your time for this assessment has ended");
    }
    return { ...state, resumed: true, code: "IN_PROGRESS" };
  }

  await assertAvailable(assessment, language);
  const pooled = Boolean(assessment.blueprint?.slots?.length);
  // With negative marking switched off, wrong answers never lose marks.
  const marking = (items) => (assessment.negative_marking === false ? items.map((x) => ({ ...x, negative_marks: 0 })) : items);
  const plan = pooled ? marking(planFromBlueprint(assessment.blueprint)) : null;
  const adaptive = pooled && Boolean(assessment.adaptive);

  // Questions to store now: the first one (pool), or the whole Phase 1 set.
  let initial;
  if (pooled) {
    const draft = { attempt: { id: 0, adaptive, language }, plan, questions: [], saved: new Map() };
    initial = [await chooseForSlot(assessment, draft, 0)];
  } else {
    initial = marking(await generateLegacySet(assessment, language));
  }

  let attempt;
  try {
    attempt = await withTransaction(async (client) => {
      const created = await attemptRepo.insertAttemptQuery(
        {
          studentId,
          assessmentId: id,
          language,
          plan: plan || planFromQuestions(initial),
          adaptive,
          difficulty: pooled ? initial[0].difficulty : null,
        },
        client
      );
      const servedAt = new Date(created.started_at);
      for (const [i, q] of initial.entries()) {
        await storeServed(client, created.id, i, q, i === 0 ? servedAt : null);
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
        return { ...(await syncAttempt(concurrent.id)), resumed: true, code: "IN_PROGRESS" };
      }
      throw new AppError("ALREADY_ATTEMPTED", 409, "You have already completed this assessment");
    }
    throw error;
  }

  if (pooled) await topUpIfLow(assessment, language);
  return { ...(await syncAttempt(attempt.id)), resumed: false };
};

/** Autosave the answer to the CURRENT question. Only the owner, only inside its time window. */
export const saveAnswerService = async (studentId, attemptId, questionId, answer) => {
  const qid = Number.parseInt(questionId, 10);

  const outcome = await withTransaction(async (client) => {
    const attempt = await requireOwnedAttempt(studentId, attemptId, client);
    if (attempt.status !== "in_progress") {
      throw new AppError("ATTEMPT_CLOSED", 409, "This attempt has already been submitted");
    }

    const questions = await attemptRepo.findAttemptQuestionsQuery(attempt.id, {}, client);
    const question = questions.find((q) => q.id === qid);
    if (!question) throw new AppError("INVALID_QUESTION", 400, "Question does not belong to this attempt");
    const order = slotOf(question);

    const timing = computeTiming(attempt, planOf(attempt, questions));
    if (timing.expired) return { expired: true, attemptId: attempt.id };
    if (order < timing.index) {
      throw new AppError("QUESTION_CLOSED", 409, "Time for this question has ended");
    }
    if (order > timing.index) {
      // Only the current question can be answered (later ones are not open yet).
      throw new AppError("QUESTION_NOT_OPEN", 409, "This question is not open yet");
    }

    const saved = await attemptRepo.findSavedAnswersQuery(attempt.id, client);
    if (saved.find((r) => r.question_id === qid)?.graded_at) {
      throw new AppError("QUESTION_CLOSED", 409, "Time for this question has ended");
    }
    const stored = canonicalStudentAnswer(question, answer);
    const row = await attemptRepo.upsertAnswerQuery({ attemptId: attempt.id, questionId: qid, answer: stored }, client);
    return { questionId: qid, savedAt: row.answered_at, currentQuestionIndex: timing.index };
  });

  if (outcome.expired) {
    await finalizeAttempt(outcome.attemptId, { expired: true });
    throw new AppError("ATTEMPT_CLOSED", 409, "Time is up; your attempt has been submitted");
  }
  return outcome;
};

/**
 * Close the current question (`fromIndex`) and serve the next one.
 * Idempotent: a repeated call for an already-closed index just returns the state.
 */
export const advanceQuestionService = async (studentId, attemptId, fromIndex) => {
  const owned = await requireOwnedAttempt(studentId, attemptId);
  if (owned.status !== "in_progress") return { finished: true, result: await buildAttemptResult(owned) };

  const outcome = await withTransaction(async (client) => {
    const ctx = await loadContext(owned.id, client);
    const { attempt, plan, slots } = ctx;
    if (attempt.status !== "in_progress") return { closed: false };
    const timing = computeTiming(attempt, plan);
    const index = Number(attempt.current_question_index) || 0;
    if (timing.expired || timing.index !== index || Number(fromIndex) !== index || !slots[index]) return { closed: false };

    const question = slots[index];
    await gradeQuestion(client, ctx, question, {
      windowStart: timing.questionStart,
      closedAt: Date.now(),
      timedOut: false,
    });
    const last = { correct: Boolean(ctx.saved.get(question.id)?.is_correct), score: Number(ctx.saved.get(question.id)?.score) || 0 };
    if (index + 1 >= plan.length) return { closed: true, finished: true, last, showLive: ctx.settings.show_live_score };
    if (slots[index + 1]) {
      // Phase 1 attempt: the next question already exists; its window starts now.
      await attemptRepo.updateAttemptServingQuery(owned.id, { index: index + 1, startedAt: new Date(), addDelayMs: 0, difficulty: null }, client);
    } else {
      // Pending: the next window opens when the next question is served (in syncAttempt).
      await attemptRepo.updateAttemptServingQuery(owned.id, { index: index + 1, startedAt: null, addDelayMs: 0, difficulty: null }, client);
    }
    return { closed: true, last, showLive: ctx.settings.show_live_score };
  });

  if (outcome.finished) {
    return { finished: true, result: await finalizeAttempt(owned.id) };
  }
  const state = await syncAttempt(owned.id);
  if (state.status === "completed") return { finished: true, result: state };
  return {
    finished: false,
    ...state,
    ...(outcome.closed && outcome.showLive ? { lastAnswer: outcome.last } : {}),
  };
};

/**
 * Submit the attempt. An answer in the payload is a final flush for the
 * current question only (if its window is still open). Everything is graded
 * from the database.
 */
export const submitAssessmentForStudentService = async (studentId, assessmentId, attemptId, answers = []) => {
  const id = parseAssessmentId(assessmentId);
  let rejectedAnswers = 0;

  const attemptRowId = await withTransaction(async (client) => {
    const attempt = await requireOwnedAttempt(studentId, attemptId, client);
    if (attempt.assessment_id !== id) throw new AppError("ATTEMPT_NOT_FOUND", 404, "Attempt not found");
    if (attempt.status !== "in_progress") return attempt.id;

    const questions = await attemptRepo.findAttemptQuestionsQuery(attempt.id, {}, client);
    const timing = computeTiming(attempt, planOf(attempt, questions));
    const savedRows = await attemptRepo.findSavedAnswersQuery(attempt.id, client);
    const saved = new Map(savedRows.map((r) => [r.question_id, r]));

    for (const item of Array.isArray(answers) ? answers : []) {
      const qid = Number.parseInt(item?.questionId, 10);
      const question = questions.find((q) => q.id === qid);
      if (!question) continue;
      const order = slotOf(question);
      const stored = canonicalStudentAnswer(question, item.answer);
      if (stored === null || stored === (saved.get(qid)?.student_answer ?? null)) continue;

      const windowOpen = !timing.expired && order === timing.index && !saved.get(qid)?.graded_at;
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
