import db, { withTransaction } from "../../DB/db.js";
import * as poolRepo from "../../repositories/poolRepository.js";
import { findObjectivesQuery } from "../../repositories/objectiveRepository.js";
import { requireAssessmentAccess } from "../assessmentAccess.js";
import { validateQuestion, stemHash, QUESTION_TYPES } from "../questions/validation.js";
import { generateObjectiveQuestions } from "../questions/generator.js";
import { embedPassages, toPgVector } from "../../helper/embeddingGenerator.js";
import { POOL_LANGUAGES, publishAssessment, retryPublish, poolStatus, loadAssessment } from "./pool.service.js";
import { AppError } from "../../utils/AppError.js";
import { decodeStoredValue, normalizeOptions } from "../../utils/grading.js";

/**
 * Instructor question bank: browse, preview, edit (versioned), retire,
 * regenerate one, add manually, approve. Editing never changes a question a
 * student already received: an edit creates a new version and retires the old
 * one, while attempts keep their own copy.
 */
const PAGE_SIZE_MAX = 100;

const invalid = (message) => new AppError("INVALID_QUESTION", 400, message);

const toItem = (row) => ({
  id: row.id,
  objectiveId: row.objective_id,
  questionType: row.question_type,
  difficulty: row.difficulty,
  language: row.language,
  questionText: row.question_text,
  options: row.question_type === "multiple_choice" ? normalizeOptions(row.options) : null,
  correctAnswer: decodeStoredValue(row.correct_answer),
  sourceChunkIds: row.source_chunk_ids || [],
  origin: row.origin,
  status: row.status,
  version: row.version,
  previousVersionId: row.previous_version_id,
  approved: Boolean(row.approved_at),
  timesServed: row.times_served,
  updatedAt: row.updated_at,
});

const requireBankAccess = async (assessmentId, user) => {
  const owned = await requireAssessmentAccess(assessmentId, user);
  const assessment = await loadAssessment(owned.id);
  if (assessment.status === "draft") {
    throw new AppError("BANK_NOT_READY", 409, "Review the learning objectives first; questions are generated from them.");
  }
  return assessment;
};

// ------------------------------------------------------------- read

export const listQuestionsService = async (assessmentId, user, query = {}) => {
  const assessment = await requireBankAccess(assessmentId, user);
  const filters = ["assessment_id = $1"];
  const params = [assessment.id];
  const add = (sql, value) => {
    params.push(value);
    filters.push(sql.replace("?", `$${params.length}`));
  };
  if (query.language) add("language = ?", String(query.language));
  if (query.objective_id) add("objective_id = ?", Number.parseInt(query.objective_id, 10) || 0);
  if (query.difficulty) add("difficulty = ?", Number.parseInt(query.difficulty, 10) || 0);
  if (query.question_type) add("question_type = ?", String(query.question_type));
  add("status = ?", query.status === "retired" ? "retired" : "active");
  if (query.search) add("question_text ILIKE ?", `%${String(query.search).slice(0, 200)}%`);

  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number.parseInt(query.page_size, 10) || 20));
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const where = filters.join(" AND ");
  const total = (await db.query(`SELECT count(*)::int AS n FROM question_pool WHERE ${where}`, params)).rows[0].n;
  const { rows } = await db.query(
    `SELECT * FROM question_pool WHERE ${where}
     ORDER BY objective_id, difficulty, question_type, id
     LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    params
  );
  return { items: rows.map(toItem), page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) };
};

export const poolStatusService = async (assessmentId, user) => {
  const owned = await requireAssessmentAccess(assessmentId, user);
  return poolStatus(owned.id);
};

// ---------------------------------------------------------- publish

export const publishService = async (assessmentId, user, languages) => {
  const owned = await requireAssessmentAccess(assessmentId, user);
  await publishAssessment(owned.id, languages);
  return poolStatus(owned.id);
};

export const retryPublishService = async (assessmentId, user) => {
  const owned = await requireAssessmentAccess(assessmentId, user);
  await retryPublish(owned.id);
  return poolStatus(owned.id);
};

// ------------------------------------------------------------ write

/** Validate an instructor-written question. */
const normalizeManual = async (assessment, body) => {
  const objectives = await findObjectivesQuery(assessment.id);
  const objectiveId = Number.parseInt(body?.objective_id ?? body?.objectiveId, 10);
  if (!objectives.some((o) => o.id === objectiveId)) throw invalid("Choose one of this assessment's objectives.");
  const type = body?.question_type ?? body?.questionType;
  if (!QUESTION_TYPES.includes(type)) throw invalid("Unknown question type.");
  const difficulty = Number(body?.difficulty);
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) throw invalid("Difficulty must be 1 to 5.");
  const language = body?.language;
  if (!POOL_LANGUAGES.includes(language)) throw invalid("Unsupported language.");
  const raw = {
    question_text: body?.question_text ?? body?.questionText,
    options: body?.options,
    correct_answer: body?.correct_answer ?? body?.correctAnswer,
  };
  const numOptions = type === "multiple_choice" ? normalizeOptions(raw.options).length : null;
  if (type === "multiple_choice" && (numOptions < 2 || numOptions > 6)) throw invalid("A multiple-choice question needs 2 to 6 options.");
  const result = validateQuestion(raw, { question_type: type, language, num_options: numOptions });
  if (!result.ok) throw invalid(VALIDATION_MESSAGES[result.reason] || "This question is not valid.");
  const [vector] = await embedPassages([result.question.question_text]);
  return {
    ...result.question,
    objective_id: objectiveId,
    question_type: type,
    difficulty,
    language,
    stem_hash: stemHash(result.question.question_text),
    embedding: toPgVector(vector),
    source_chunk_ids: [],
  };
};

export const VALIDATION_MESSAGES = {
  empty_stem: "Write the question text.",
  wrong_language: "The question and options must be written in the selected language.",
  option_count: "Check the number of options.",
  duplicate_options: "Options must all be different.",
  multiple_correct: "Exactly one option must be correct.",
  answer_not_an_option: "The correct answer must be one of the options.",
  answer_in_stem: "The question text gives away the answer.",
  answer_not_boolean: "The answer must be True or False.",
  no_answer: "Give a model answer or at least one required concept.",
};

const duplicate = () => new AppError("DUPLICATE_QUESTION", 409, "An active question with the same text already exists.");

export const addQuestionService = async (assessmentId, user, body) => {
  const assessment = await requireBankAccess(assessmentId, user);
  const q = await normalizeManual(assessment, body);
  const row = await poolRepo.insertPoolQuestionQuery(assessment.id, {
    ...q,
    origin: "manual",
    approved_at: new Date(),
    approved_by: user.id,
    created_by: user.id,
  });
  if (!row) throw duplicate();
  return toItem(await poolRepo.findPoolQuestionQuery(assessment.id, row.id));
};

const requireActiveQuestion = async (assessment, questionId, client) => {
  const id = Number.parseInt(questionId, 10);
  const row = Number.isInteger(id) ? await poolRepo.findPoolQuestionQuery(assessment.id, id, client, { forUpdate: true }) : null;
  if (!row) throw new AppError("QUESTION_NOT_FOUND", 404, "Question not found");
  if (row.status !== "active") throw new AppError("QUESTION_RETIRED", 409, "This question version is no longer active.");
  return row;
};

/** Edit = new version (old one retired); the bucket (objective, type, language) stays the same. */
export const editQuestionService = async (assessmentId, questionId, user, body) => {
  const assessment = await requireBankAccess(assessmentId, user);
  const current = await requireActiveQuestion(assessment, questionId);
  const q = await normalizeManual(assessment, {
    objective_id: current.objective_id,
    question_type: current.question_type,
    language: current.language,
    difficulty: body?.difficulty ?? current.difficulty,
    question_text: body?.question_text ?? body?.questionText,
    options: body?.options,
    correct_answer: body?.correct_answer ?? body?.correctAnswer,
  });
  const created = await withTransaction(async (client) => {
    const locked = await requireActiveQuestion(assessment, questionId, client);
    await poolRepo.retirePoolQuestionQuery(locked.id, client);
    const row = await poolRepo.insertPoolQuestionQuery(
      assessment.id,
      {
        ...q,
        origin: locked.origin,
        source_chunk_ids: locked.source_chunk_ids,
        version: locked.version + 1,
        previous_version_id: locked.id,
        approved_at: new Date(),
        approved_by: user.id,
        created_by: user.id,
      },
      client
    );
    if (!row) throw duplicate();
    return row;
  });
  return toItem(await poolRepo.findPoolQuestionQuery(assessment.id, created.id));
};

export const retireQuestionService = async (assessmentId, questionId, user) => {
  const assessment = await requireBankAccess(assessmentId, user);
  const row = await requireActiveQuestion(assessment, questionId);
  await poolRepo.retirePoolQuestionQuery(row.id);
  return { id: row.id, status: "retired" };
};

export const approveQuestionService = async (assessmentId, questionId, user) => {
  const assessment = await requireBankAccess(assessmentId, user);
  const row = await requireActiveQuestion(assessment, questionId);
  await db.query(`UPDATE question_pool SET approved_at = NOW(), approved_by = $2 WHERE id = $1`, [row.id, user.id]);
  return toItem(await poolRepo.findPoolQuestionQuery(assessment.id, row.id));
};

/** Replace one question with a freshly generated one from the same bucket. */
export const regenerateQuestionService = async (assessmentId, questionId, user) => {
  const assessment = await requireBankAccess(assessmentId, user);
  const current = await requireActiveQuestion(assessment, questionId);
  const objective = (await findObjectivesQuery(assessment.id)).find((o) => o.id === current.objective_id);
  if (!objective) throw new AppError("QUESTION_NOT_FOUND", 404, "Question not found");
  const existing = await poolRepo.findActiveHashesQuery(assessment.id, current.language);
  const { questions } = await generateObjectiveQuestions({
    assessment,
    objective,
    language: current.language,
    requests: [
      {
        question_type: current.question_type,
        difficulty: current.difficulty,
        num_options: current.question_type === "multiple_choice" ? normalizeOptions(current.options).length : null,
        count: 1,
      },
    ],
    excludeHashes: new Set(existing.map((e) => e.stem_hash)),
    avoidStems: [current.question_text],
    userId: user.id,
    purpose: "pool_regenerate_one",
  });
  if (!questions.length) {
    throw new AppError("GENERATION_FAILED", 503, "A replacement could not be generated right now. Please try again.");
  }
  const [vector] = await embedPassages([questions[0].question_text]);
  const created = await withTransaction(async (client) => {
    const locked = await requireActiveQuestion(assessment, questionId, client);
    await poolRepo.retirePoolQuestionQuery(locked.id, client);
    const row = await poolRepo.insertPoolQuestionQuery(
      assessment.id,
      { ...questions[0], embedding: toPgVector(vector), origin: "ai", version: locked.version + 1, previous_version_id: locked.id },
      client
    );
    if (!row) throw duplicate();
    return row;
  });
  return toItem(await poolRepo.findPoolQuestionQuery(assessment.id, created.id));
};
