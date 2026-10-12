import { AppError } from "../utils/AppError.js";

const TYPE_ALIASES = {
  multipleChoice: "multiple_choice",
  trueFalse: "true_false",
  shortAnswer: "short_answer",
};
const QUESTION_TYPES = ["multiple_choice", "true_false", "short_answer"];

export const LIMITS = {
  titleMax: 255,
  promptMax: 10000,
  maxBlocks: 20,
  maxQuestionsPerBlock: 100,
  minDurationSeconds: 30,
  maxDurationSeconds: 3600,
  minOptions: 2,
  maxOptions: 6,
};

const invalid = (message) => new AppError("INVALID_ASSESSMENT", 400, message);

/** multipart/form-data sends JSON fields as strings. */
export const parseJsonField = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    throw invalid("Malformed request: a JSON field could not be parsed.");
  }
};

const isInt = (n) => Number.isInteger(n);

/** Validate and normalize question blocks. Throws AppError(400) with a specific message. */
export const normalizeQuestionBlocks = (rawBlocks) => {
  if (!Array.isArray(rawBlocks) || rawBlocks.length === 0) {
    throw invalid("Add at least one question block.");
  }
  if (rawBlocks.length > LIMITS.maxBlocks) {
    throw invalid(`At most ${LIMITS.maxBlocks} question blocks are allowed.`);
  }

  return rawBlocks.map((block, i) => {
    const label = `Question block ${i + 1}`;
    const type = TYPE_ALIASES[block?.question_type] || block?.question_type;
    if (!QUESTION_TYPES.includes(type)) throw invalid(`${label}: unknown question type.`);

    const count = Number(block.question_count);
    if (!isInt(count) || count < 1 || count > LIMITS.maxQuestionsPerBlock) {
      throw invalid(`${label}: question count must be between 1 and ${LIMITS.maxQuestionsPerBlock}.`);
    }

    const duration = Number(block.duration_per_question);
    if (!isInt(duration) || duration < LIMITS.minDurationSeconds || duration > LIMITS.maxDurationSeconds) {
      throw invalid(
        `${label}: time per question must be between ${LIMITS.minDurationSeconds} and ${LIMITS.maxDurationSeconds} seconds.`
      );
    }

    let numOptions = null;
    if (type === "multiple_choice") {
      numOptions = Number(block.num_options ?? 4);
      if (!isInt(numOptions) || numOptions < LIMITS.minOptions || numOptions > LIMITS.maxOptions) {
        throw invalid(`${label}: multiple choice needs ${LIMITS.minOptions}-${LIMITS.maxOptions} options.`);
      }
    }

    const positive = block.positive_marks === undefined || block.positive_marks === null ? 1 : Number(block.positive_marks);
    const negative = block.negative_marks === undefined || block.negative_marks === null ? 0 : Number(block.negative_marks);
    if (!Number.isFinite(positive) || positive < 0 || positive > 100) throw invalid(`${label}: marks for a correct answer must be 0-100.`);
    if (!Number.isFinite(negative) || negative < 0 || negative > 100) throw invalid(`${label}: deduction for a wrong answer must be 0-100.`);

    return {
      question_type: type,
      question_count: count,
      duration_per_question: duration,
      num_options: numOptions,
      positive_marks: positive,
      negative_marks: negative,
    };
  });
};

export const normalizeLinks = (rawLinks) => {
  const links = Array.isArray(rawLinks) ? rawLinks : [];
  return links
    .map((l) => (typeof l === "string" ? l.trim() : ""))
    .filter(Boolean)
    .map((l) => {
      let url;
      try {
        url = new URL(l);
      } catch {
        throw invalid(`"${l}" is not a valid link.`);
      }
      if (!["http:", "https:"].includes(url.protocol)) throw invalid(`"${l}" must start with http:// or https://.`);
      return url.toString();
    });
};

export const normalizeResourceIds = (raw) => {
  const ids = Array.isArray(raw) ? raw : [];
  return [...new Set(ids.map((id) => Number.parseInt(id, 10)).filter((id) => Number.isInteger(id) && id > 0))];
};

/**
 * Validate the shared fields of create/update.
 * Minimal input rule: a title plus at least one source (prompt, link, resource or file).
 */
export const normalizeAssessmentInput = ({ title, prompt, links, resourceIds, fileCount }) => {
  const cleanTitle = typeof title === "string" ? title.trim() : "";
  if (!cleanTitle) throw invalid("Title is required.");
  if (cleanTitle.length > LIMITS.titleMax) throw invalid(`Title must be at most ${LIMITS.titleMax} characters.`);

  const cleanPrompt = typeof prompt === "string" ? prompt.trim() : "";
  if (cleanPrompt.length > LIMITS.promptMax) throw invalid(`Prompt must be at most ${LIMITS.promptMax} characters.`);

  if (!cleanPrompt && links.length === 0 && resourceIds.length === 0 && fileCount === 0) {
    throw invalid("Provide a prompt, a resource, a file or a link to generate questions from.");
  }

  return { title: cleanTitle, prompt: cleanPrompt || null };
};
