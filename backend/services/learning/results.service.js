import * as attemptRepo from "../../repositories/attemptRepository.js";
import { findObjectivesQuery } from "../../repositories/objectiveRepository.js";
import { buildAttemptResult } from "../studentAssessment.service.js";
import { AppError } from "../../utils/AppError.js";

/**
 * Student-facing results of a COMPLETED attempt: scores, accuracy, time,
 * per-objective breakdown, weak areas, difficulty path and the full review.
 * Nothing here is available while the attempt is in progress, so answers
 * and objectives can never be seen before submitting.
 */
export const WEAK_THRESHOLD = 60; // accuracy % below which an objective is a weak area
const MAX_WEAK_AREAS = 5;

const round = (n) => Math.round(n * 10) / 10;

/** The student's completed attempt or a 404 (never someone else's, never in progress). */
export const requireCompletedAttempt = async (studentId, assessmentId) => {
  const id = Number.parseInt(assessmentId, 10);
  if (!Number.isInteger(id)) throw new AppError("RESULTS_NOT_FOUND", 404, "Results not found");
  const attempt = await attemptRepo.findOnlineAttemptQuery(studentId, id);
  if (!attempt || attempt.status !== "completed") {
    throw new AppError("RESULTS_NOT_FOUND", 404, "Results are available after you submit this assessment.");
  }
  return attempt;
};

/** Per-objective accuracy, counting questions never reached as not correct. */
export const objectiveBreakdown = (result, plan, objectives) => {
  const rows = new Map(
    objectives.map((o, i) => [
      o.id,
      { objectiveId: o.id, number: i + 1, text: o.text, description: o.description, questions: 0, answered: 0, correct: 0, marksEarned: 0, marksPossible: 0 },
    ])
  );
  for (const a of result.answers) {
    const row = rows.get(a.objectiveId);
    if (!row) continue;
    row.questions += 1;
    row.answered += a.answered ? 1 : 0;
    row.correct += a.isCorrect ? 1 : 0;
    row.marksEarned += a.score;
    row.marksPossible += a.positiveMarks;
  }
  // Slots that were never reached still belong to their objective.
  const servedPerObjective = new Map();
  for (const a of result.answers) servedPerObjective.set(a.objectiveId, (servedPerObjective.get(a.objectiveId) || 0) + 1);
  const plannedPerObjective = new Map();
  for (const slot of plan || []) plannedPerObjective.set(slot.objective_id, (plannedPerObjective.get(slot.objective_id) || 0) + 1);
  for (const [objectiveId, planned] of plannedPerObjective) {
    const row = rows.get(objectiveId);
    if (!row) continue;
    const missing = planned - (servedPerObjective.get(objectiveId) || 0);
    if (missing > 0) {
      row.questions += missing;
      const slot = plan.find((s) => s.objective_id === objectiveId);
      row.marksPossible += missing * (Number(slot?.positive_marks) || 0);
    }
  }
  return [...rows.values()]
    .filter((r) => r.questions > 0)
    .map((r) => ({ ...r, marksEarned: round(r.marksEarned), accuracy: round((r.correct / r.questions) * 100) }));
};

export const weakAreasOf = (breakdown) =>
  breakdown
    .filter((r) => r.accuracy < WEAK_THRESHOLD)
    .sort((a, b) => a.accuracy - b.accuracy || b.questions - a.questions)
    .slice(0, MAX_WEAK_AREAS);

export const getResultsService = async (studentId, assessmentId) => {
  const attempt = await requireCompletedAttempt(studentId, assessmentId);
  const [result, assessment, objectives] = await Promise.all([
    buildAttemptResult(attempt),
    attemptRepo.findAssessmentForStartQuery(attempt.assessment_id),
    findObjectivesQuery(attempt.assessment_id),
  ]);
  const breakdown = objectiveBreakdown(result, attempt.plan, objectives);
  const totalQuestions = result.answers.length + result.notReachedCount;
  const answered = result.answers.filter((a) => a.answered).length;
  const timeTotal = result.answers.reduce((s, a) => s + (Number(a.timeTakenSeconds) || 0), 0);

  return {
    assessmentId: attempt.assessment_id,
    attemptId: attempt.id,
    title: assessment?.title,
    language: attempt.language,
    adaptive: result.adaptive,
    completedAt: result.completedAt,
    scores: {
      score: result.score,
      totalMarks: result.totalMarks,
      rawPercentage: result.rawPercentage,
      adjustedPercentage: result.adjustedPercentage,
    },
    accuracy: {
      totalQuestions,
      answered,
      correct: result.correctCount,
      incorrect: result.incorrectCount,
      unanswered: result.unansweredCount,
      notReached: result.notReachedCount,
      percentage: totalQuestions ? round((result.correctCount / totalQuestions) * 100) : 0,
      answeredPercentage: answered ? round((result.correctCount / answered) * 100) : 0,
    },
    time: {
      totalSeconds: result.timeTakenSeconds,
      averagePerQuestionSeconds: result.answers.length ? round(timeTotal / result.answers.length) : 0,
    },
    objectives: breakdown,
    weakAreas: weakAreasOf(breakdown),
    difficultyPath: result.answers.map((a, i) => ({
      index: i + 1,
      difficulty: a.difficulty,
      correct: a.isCorrect,
      answered: a.answered,
      timedOut: a.timedOut,
      objectiveId: a.objectiveId,
    })),
    review: result.answers.map((a) => ({
      question_id: a.questionId,
      question_order: a.questionOrder,
      question_type: a.questionType,
      question_text: a.questionText,
      options: a.options,
      correct_answer: a.correctAnswer,
      student_answer: a.studentAnswer,
      answered: a.answered,
      is_correct: a.isCorrect,
      score: a.score,
      positive_marks: a.positiveMarks,
      negative_marks: a.negativeMarks,
      objective_id: a.objectiveId,
      difficulty: a.difficulty,
      time_taken_seconds: a.timeTakenSeconds,
      timed_out: a.timedOut,
    })),
  };
};
