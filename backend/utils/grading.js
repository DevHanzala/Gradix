/**
 * Single source of truth for answer normalization and grading.
 * Used by submit-time grading, the review screens and analytics, so a
 * question can never be "correct" in one place and "wrong" in another.
 *
 * All text handling is Unicode-aware: Urdu, Arabic and Persian answers are
 * compared after NFC normalization, case folding and punctuation stripping.
 */

const TATWEEL = /ـ/g; // Arabic elongation character, purely cosmetic

/** NFC, trim, case-fold, strip punctuation (\p{P}), collapse whitespace. */
export const normalizeText = (value) => {
  if (value === null || value === undefined) return "";
  return String(value)
    .normalize("NFC")
    .replace(TATWEEL, "")
    .toLocaleLowerCase()
    .replace(/\p{P}+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
};

/**
 * Values read from the DB may be JSONB (already decoded) or legacy TEXT that
 * holds a JSON-encoded string such as "\"B. Paris\"". Decode only when the
 * text is unambiguously JSON; plain strings are returned untouched.
 */
export const decodeStoredValue = (value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  const looksJson =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"));
  if (!looksJson) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

// ---------------------------------------------------------------- MCQ

const LETTER_PREFIX = /^\s*([A-Za-z])\s*[.)\]:-]\s*(.*)$/su;
const LETTER_ONLY = /^\s*\(?([A-Za-z])\)?\s*[.)\]:-]?\s*$/u;

/** Strip a leading "A." / "B)" label from an option, keeping its text. */
export const stripOptionLabel = (option) => {
  const text = String(option ?? "");
  const match = text.match(LETTER_PREFIX);
  return match && match[2].trim() ? match[2].trim() : text.trim();
};

/** Normalize an options array to plain option texts (no "A." labels). */
export const normalizeOptions = (options) => {
  const decoded = decodeStoredValue(options);
  if (Array.isArray(decoded)) return decoded.map(stripOptionLabel);
  if (decoded && typeof decoded === "object") {
    // Legacy shape: { "A": "Paris", "B": "Rome" }
    return Object.keys(decoded)
      .sort()
      .map((key) => stripOptionLabel(decoded[key]));
  }
  return [];
};

/**
 * Map any reasonable answer form to an option index:
 * 1, "B", "b", "B.", "(B)", "B. Paris", "Paris", or a stored full option.
 * Returns null when the answer cannot be matched unambiguously.
 */
export const canonicalOptionIndex = (answer, options) => {
  const texts = normalizeOptions(options);
  if (texts.length === 0) return null;

  const value = decodeStoredValue(answer);
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number" && Number.isInteger(value)) {
    return value >= 0 && value < texts.length ? value : null;
  }

  const raw = String(value);
  const normalizedTexts = texts.map(normalizeText);

  // Exact option text first (handles options that themselves start with a letter).
  const exact = normalizedTexts.indexOf(normalizeText(raw));
  if (exact !== -1 && normalizedTexts.indexOf(normalizeText(raw), exact + 1) === -1) {
    return exact;
  }

  const letterOnly = raw.match(LETTER_ONLY);
  if (letterOnly) {
    const index = letterOnly[1].toUpperCase().charCodeAt(0) - 65;
    return index >= 0 && index < texts.length ? index : null;
  }

  const prefixed = raw.match(LETTER_PREFIX);
  if (prefixed) {
    const index = prefixed[1].toUpperCase().charCodeAt(0) - 65;
    const byText = normalizedTexts.indexOf(normalizeText(prefixed[2]));
    if (byText !== -1) return byText;
    if (index >= 0 && index < texts.length) return index;
  }

  return null;
};

/** Canonical stored form of an MCQ answer: the plain option text, or null. */
export const canonicalOption = (answer, options) => {
  const index = canonicalOptionIndex(answer, options);
  return index === null ? null : normalizeOptions(options)[index];
};

// ---------------------------------------------------------- True/False

const TRUE_WORDS = new Set(
  ["true", "t", "yes", "1", "correct", "درست", "صحیح", "صحيح", "صواب", "نعم", "بله", "ہاں"].map(normalizeText)
);
const FALSE_WORDS = new Set(
  ["false", "f", "no", "0", "incorrect", "غلط", "نادرست", "خطأ", "خاطئ", "لا", "خیر", "نہیں"].map(normalizeText)
);

/** Returns true, false, or null when the value is not a recognizable boolean. */
export const parseBoolean = (value) => {
  const decoded = decodeStoredValue(value);
  if (typeof decoded === "boolean") return decoded;
  if (decoded === null || decoded === undefined) return null;
  const normalized = normalizeText(decoded);
  if (TRUE_WORDS.has(normalized)) return true;
  if (FALSE_WORDS.has(normalized)) return false;
  return null;
};

// -------------------------------------------------------- Short answer

/**
 * Accepts the rule shapes the generator may produce:
 *   { answer, required_keywords, min_required_match } | "model answer" | ["kw1", "kw2"]
 */
export const parseShortAnswerRule = (rule) => {
  const decoded = decodeStoredValue(rule);
  if (Array.isArray(decoded)) {
    const keywords = decoded.map(String).filter((k) => normalizeText(k));
    return { answer: null, keywords, minMatch: keywords.length };
  }
  if (decoded && typeof decoded === "object") {
    const keywords = (decoded.required_keywords || decoded.keywords || [])
      .map(String)
      .filter((k) => normalizeText(k));
    const requested = Number(decoded.min_required_match);
    const minMatch =
      keywords.length === 0
        ? 0
        : Number.isInteger(requested) && requested > 0
          ? Math.min(requested, keywords.length)
          : keywords.length;
    const answer = decoded.answer ?? decoded.model_answer ?? null;
    return { answer: answer === null ? null : String(answer), keywords, minMatch };
  }
  if (typeof decoded === "string" && normalizeText(decoded)) {
    return { answer: decoded, keywords: [], minMatch: 0 };
  }
  return { answer: null, keywords: [], minMatch: 0 };
};

const evaluateShortAnswer = (studentAnswer, rule) => {
  const student = normalizeText(studentAnswer);
  if (!student) return false;

  const { answer, keywords, minMatch } = parseShortAnswerRule(rule);

  if (keywords.length > 0) {
    const matched = keywords.filter((keyword) => student.includes(normalizeText(keyword))).length;
    return matched >= Math.max(1, minMatch);
  }

  if (answer) {
    const expected = normalizeText(answer);
    return expected.length > 0 && (student === expected || student.includes(expected));
  }

  // No usable rule: never mark an answer correct by default.
  return false;
};

// ------------------------------------------------------------- Grading

/** True when the student actually gave an answer. */
export const isAnswered = (studentAnswer) => {
  const decoded = decodeStoredValue(studentAnswer);
  if (decoded === null || decoded === undefined) return false;
  if (typeof decoded === "boolean" || typeof decoded === "number") return true;
  return normalizeText(decoded).length > 0;
};

/** Is `studentAnswer` correct for `question` ({ question_type, options, correct_answer })? */
export const isAnswerCorrect = (question, studentAnswer) => {
  if (!isAnswered(studentAnswer)) return false;

  switch (question.question_type) {
    case "multiple_choice": {
      const expected = canonicalOptionIndex(question.correct_answer, question.options);
      const given = canonicalOptionIndex(studentAnswer, question.options);
      return expected !== null && given !== null && expected === given;
    }
    case "true_false": {
      const expected = parseBoolean(question.correct_answer);
      const given = parseBoolean(studentAnswer);
      return expected !== null && given !== null && expected === given;
    }
    case "short_answer":
      return evaluateShortAnswer(studentAnswer, question.correct_answer);
    default:
      return false;
  }
};

/**
 * Score one question. Correct: +positive. Wrong: -|negative|. Unanswered: 0.
 */
export const gradeAnswer = (question, studentAnswer) => {
  const answered = isAnswered(studentAnswer);
  const correct = answered && isAnswerCorrect(question, studentAnswer);
  const positive = Number(question.positive_marks ?? 1) || 0;
  const negative = Math.abs(Number(question.negative_marks ?? 0) || 0);
  const score = correct ? positive : answered ? -negative : 0;
  return { answered, correct, score };
};

/**
 * Canonical form to store for a student's answer, so the DB holds
 * "Paris" rather than "B" / "B. Paris" / "b".
 */
export const canonicalStudentAnswer = (question, answer) => {
  if (!isAnswered(answer)) return null;
  switch (question.question_type) {
    case "multiple_choice":
      return canonicalOption(answer, question.options) ?? String(answer).trim();
    case "true_false": {
      const parsed = parseBoolean(answer);
      return parsed === null ? String(answer).trim() : String(parsed);
    }
    default:
      return String(answer).trim();
  }
};

// ---------------------------------------------------------------- Review

/**
 * Shape one question for a review screen (student or instructor) using the
 * same grading function as submission, so the screens always agree with the score.
 * `row` needs question_type, options, correct_answer, student_answer and marks.
 */
export const toReviewItem = (row) => {
  const { answered, correct, score } = gradeAnswer(row, row.student_answer);
  const options = row.question_type === "multiple_choice" ? normalizeOptions(row.options) : null;
  return {
    question_order: row.question_order,
    question_type: row.question_type,
    question_text: row.question_text,
    options,
    correct_answer: decodeStoredValue(row.correct_answer),
    student_answer: row.student_answer ?? null,
    answered,
    is_correct: correct,
    score,
    positive_marks: Number(row.positive_marks),
    negative_marks: Number(row.negative_marks),
  };
};
