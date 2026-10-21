import db from "../../DB/db.js";
import { findObjectivesQuery } from "../../repositories/objectiveRepository.js";
import { generateObjectiveQuestions } from "../questions/generator.js";
import { gradeAnswer, normalizeOptions, decodeStoredValue } from "../../utils/grading.js";
import { normalizeLanguage } from "../../helper/i18n.js";
import { AppError } from "../../utils/AppError.js";
import { getResultsService } from "./results.service.js";

/**
 * Ungraded practice after an attempt. Questions are generated fresh for the
 * student's weak objectives and are NEVER taken from (or added to) the exam
 * pool, so practising cannot reveal exam questions to anyone. Nothing here
 * affects scores; answers are checked with the shared grader.
 */
export const PRACTICE_LIMITS = { min: 1, max: 10, default: 5 };
const PRACTICE_TYPES = ["multiple_choice", "true_false"];

const toPublic = (q, index) => ({
  index,
  question_type: q.question_type,
  question_text: q.question_text,
  options: q.question_type === "multiple_choice" ? normalizeOptions(q.options) : null,
  objectiveId: q.objective_id,
  difficulty: q.difficulty,
});

export const createPracticeService = async (student, assessmentId, { language: requested, count } = {}) => {
  const results = await getResultsService(student.id, assessmentId);
  const language = normalizeLanguage(requested || results.language);
  const total = Math.min(PRACTICE_LIMITS.max, Math.max(PRACTICE_LIMITS.min, Number.parseInt(count, 10) || PRACTICE_LIMITS.default));
  const objectives = new Map((await findObjectivesQuery(results.assessmentId)).map((o) => [o.id, o]));
  const focus = (results.weakAreas.length ? results.weakAreas : results.objectives).filter((o) => objectives.has(o.objectiveId));
  if (!focus.length) {
    throw new AppError("PRACTICE_UNAVAILABLE", 409, "Practice is available for assessments with learning objectives.");
  }

  // Spread the questions over the focus objectives (weakest first), medium-easy difficulty.
  const perObjective = new Map();
  for (let i = 0; i < total; i++) {
    const o = focus[i % focus.length];
    perObjective.set(o.objectiveId, (perObjective.get(o.objectiveId) || 0) + 1);
  }

  const questions = [];
  const seen = new Set();
  for (const [objectiveId, n] of perObjective) {
    const requests = Array.from({ length: n }, (_, i) => ({
      question_type: PRACTICE_TYPES[i % PRACTICE_TYPES.length],
      difficulty: 2 + (i % 2),
      num_options: 4,
      count: 1,
    }));
    try {
      const { questions: made } = await generateObjectiveQuestions({
        assessment: { id: results.assessmentId, title: results.title },
        objective: objectives.get(objectiveId),
        language,
        requests,
        excludeHashes: seen,
        userId: student.id,
        purpose: "practice",
      });
      for (const q of made) {
        seen.add(q.stem_hash);
        questions.push(q);
      }
    } catch (error) {
      console.error(`[practice] objective ${objectiveId}: ${error.message}`);
    }
  }
  if (!questions.length) {
    throw new AppError("PRACTICE_UNAVAILABLE", 503, "Practice questions could not be prepared right now. Please try again.");
  }

  const { rows } = await db.query(
    `INSERT INTO practice_sessions (student_id, assessment_id, language, questions) VALUES ($1, $2, $3, $4) RETURNING id`,
    [student.id, results.assessmentId, language, JSON.stringify(questions)]
  );
  return { sessionId: rows[0].id, language, questions: questions.map(toPublic) };
};

export const checkPracticeAnswerService = async (student, sessionId, index, answer) => {
  const id = Number.parseInt(sessionId, 10);
  const { rows } = await db.query(`SELECT * FROM practice_sessions WHERE id = $1 AND student_id = $2`, [
    Number.isInteger(id) ? id : 0,
    student.id,
  ]);
  const session = rows[0];
  if (!session) throw new AppError("PRACTICE_NOT_FOUND", 404, "Practice session not found");
  const q = session.questions[Number.parseInt(index, 10)];
  if (!q) throw new AppError("INVALID_QUESTION", 400, "Question does not belong to this practice session");
  const { correct, answered } = gradeAnswer({ ...q, positive_marks: 1, negative_marks: 0 }, answer);
  return { index: Number(index), answered, correct, correctAnswer: decodeStoredValue(q.correct_answer) };
};
