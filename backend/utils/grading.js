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
 *   { answer, rubric: [{ concept, accept: [...] }], min_required_match }   (Phase 2 AI rubric)
 *   { answer, required_keywords, min_required_match } | "model answer" | ["kw1", "kw2"]
 *
 * Returns { answer, concepts, keywords, minMatch } where each concept is a list
 * of acceptable phrasings; a concept counts as present when any phrasing appears
 * in the student's answer. `keywords` (one phrasing per concept) is kept for
 * older callers.
 */
export const parseShortAnswerRule = (rule) => {
  const decoded = decodeStoredValue(rule);
  const clean = (list) => (Array.isArray(list) ? list.map(String).filter((k) => normalizeText(k)) : []);
  const build = (answer, concepts, requested) => {
    const minMatch =
      concepts.length === 0
        ? 0
        : Number.isInteger(requested) && requested > 0
          ? Math.min(requested, concepts.length)
          : concepts.length;
    return { answer, concepts, keywords: concepts.map((c) => c[0]), minMatch };
  };

  if (Array.isArray(decoded)) {
    return build(null, clean(decoded).map((k) => [k]), null);
  }
  if (decoded && typeof decoded === "object") {
    const rubric = Array.isArray(decoded.rubric)
      ? decoded.rubric
          .map((item) => clean([item?.concept, ...(Array.isArray(item?.accept) ? item.accept : [])]))
          .filter((phrases) => phrases.length > 0)
      : [];
    const concepts = rubric.length ? rubric : clean(decoded.required_keywords || decoded.keywords).map((k) => [k]);
    const answer = decoded.answer ?? decoded.model_answer ?? null;
    return build(answer === null ? null : String(answer), concepts, Number(decoded.min_required_match));
  }
  if (typeof decoded === "string" && normalizeText(decoded)) {
    return build(decoded, [], null);
  }
  return build(null, [], null);
};

const evaluateShortAnswer = (studentAnswer, rule) => {
  const student = normalizeText(studentAnswer);
  if (!student) return false;

  const { answer, concepts, minMatch } = parseShortAnswerRule(rule);

  if (concepts.length > 0) {
    const matched = concepts.filter((phrases) => phrases.some((p) => student.includes(normalizeText(p)))).length;
    return matched >= Math.max(1, minMatch);
  }

  if (answer) {
    const expected = normalizeText(answer);
    return expected.length > 0 && (student === expected || student.includes(expected));
  }

  // No usable rule: never mark an answer correct by default.
  return false;
};

// ------------------------------------------------------ Fill in the blank

/** Blank markers in a fill-in-the-blank stem: [[1]], [[2]]... */
export const BLANK_MARKER = /\[\[(\d+)\]\]/g;
export const blankCount = (text) => new Set([...String(text || "").matchAll(BLANK_MARKER)].map((m) => m[1])).size;

/** Accepted answers per blank: [["Paris"], ["Seine", "the Seine"]]. */
export const parseBlankRule = (rule) => {
  const decoded = decodeStoredValue(rule);
  const blanks = Array.isArray(decoded?.blanks) ? decoded.blanks : Array.isArray(decoded) ? decoded : [];
  return blanks.map((accepted) => [].concat(accepted ?? []).map(String).filter((a) => normalizeText(a)));
};

/** The student's blanks as a list of strings (an array, or { "0": "...", ... }). */
const blankAnswers = (studentAnswer) => {
  const decoded = decodeStoredValue(studentAnswer);
  if (Array.isArray(decoded)) return decoded.map((v) => (v === null || v === undefined ? "" : String(v)));
  if (decoded && typeof decoded === "object") {
    return Object.keys(decoded)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => String(decoded[k] ?? ""));
  }
  return typeof decoded === "string" ? [decoded] : [];
};

/** How many blanks are right (Unicode-safe comparison through normalizeText). */
const blankResult = (question, studentAnswer) => {
  const rule = parseBlankRule(question.correct_answer);
  const given = blankAnswers(studentAnswer);
  const right = rule.filter((accepted, i) => normalizeText(given[i]) && accepted.some((a) => normalizeText(a) === normalizeText(given[i]))).length;
  return { right, total: rule.length };
};

// ------------------------------------------------------------- Matching

/** Matching options: { left: [...], right: [...] } (the right column is stored shuffled). */
export const matchingOptions = (options) => {
  const decoded = decodeStoredValue(options);
  const list = (v) => (Array.isArray(v) ? v.map((x) => String(x ?? "")) : []);
  return { left: list(decoded?.left), right: list(decoded?.right) };
};

/** Correct pairs { "<left index>": "<right text>" } and whether partial credit is given. */
export const parseMatchingRule = (rule) => {
  const decoded = decodeStoredValue(rule);
  const pairs = decoded && typeof decoded.pairs === "object" && decoded.pairs ? decoded.pairs : {};
  return { pairs, partialCredit: decoded?.partial_credit !== false };
};

const matchingResult = (question, studentAnswer) => {
  const { left } = matchingOptions(question.options);
  const { pairs } = parseMatchingRule(question.correct_answer);
  const decoded = decodeStoredValue(studentAnswer);
  const given = decoded && typeof decoded === "object" ? decoded : {};
  const right = left.filter((_, i) => normalizeText(given[i]) && normalizeText(given[i]) === normalizeText(pairs[i])).length;
  return { right, total: left.length };
};

// ------------------------------------------------------------- Grading

/** Question types and how many parts they have to answer. */
export const QUESTION_TYPES = ["multiple_choice", "true_false", "short_answer", "fill_blank", "matching"];
export const STRUCTURED_TYPES = ["fill_blank", "matching"];

/** True when the student actually gave an answer (for structured answers: at least one part). */
export const isAnswered = (studentAnswer) => {
  const decoded = decodeStoredValue(studentAnswer);
  if (decoded === null || decoded === undefined) return false;
  if (typeof decoded === "boolean" || typeof decoded === "number") return true;
  if (Array.isArray(decoded)) return decoded.some((v) => normalizeText(v).length > 0);
  if (typeof decoded === "object") return Object.values(decoded).some((v) => normalizeText(v).length > 0);
  return normalizeText(decoded).length > 0;
};

/**
 * Share of the question that is right, 0 to 1. Every type is all-or-nothing except
 * matching with partial credit (right pairs / all pairs).
 */
export const answerFraction = (question, studentAnswer) => {
  if (!isAnswered(studentAnswer)) return 0;
  if (question.question_type === "matching") {
    const { right, total } = matchingResult(question, studentAnswer);
    if (!total) return 0;
    return parseMatchingRule(question.correct_answer).partialCredit ? right / total : right === total ? 1 : 0;
  }
  return isAnswerCorrect(question, studentAnswer) ? 1 : 0;
};

/** Is `studentAnswer` fully correct for `question` ({ question_type, options, correct_answer })? */
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
    case "fill_blank": {
      const { right, total } = blankResult(question, studentAnswer);
      return total > 0 && right === total;
    }
    case "matching": {
      const { right, total } = matchingResult(question, studentAnswer);
      return total > 0 && right === total;
    }
    default:
      return false;
  }
};

/**
 * Score one question. Fully correct: +positive. Partly correct (matching with partial
 * credit): +positive x share right. Wrong: -|negative|. Unanswered: 0.
 */
export const gradeAnswer = (question, studentAnswer) => {
  const answered = isAnswered(studentAnswer);
  const fraction = answered ? answerFraction(question, studentAnswer) : 0;
  const correct = answered && fraction === 1;
  const positive = Number(question.positive_marks ?? 1) || 0;
  const negative = Math.abs(Number(question.negative_marks ?? 0) || 0);
  const score = fraction > 0 ? Math.round(positive * fraction * 100) / 100 : answered ? -negative : 0;
  return { answered, correct, score, fraction };
};

/**
 * Canonical form to store for a student's answer, so the DB holds
 * "Paris" rather than "B" / "B. Paris" / "b". Structured answers are stored as JSON.
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
    case "fill_blank":
      return JSON.stringify(blankAnswers(answer).map((v) => v.trim().slice(0, 200)));
    case "matching": {
      const decoded = decodeStoredValue(answer);
      const { left } = matchingOptions(question.options);
      const clean = {};
      for (let i = 0; i < left.length; i++) if (decoded?.[i] !== undefined && decoded[i] !== null) clean[i] = String(decoded[i]).slice(0, 200);
      return JSON.stringify(clean);
    }
    default:
      return String(answer).trim();
  }
};

/** Options as shown to a student: MCQ texts, matching columns, or null. Never contains the answer. */
export const questionOptions = (question) => {
  if (question.question_type === "multiple_choice") return normalizeOptions(question.options);
  if (question.question_type === "matching") return matchingOptions(question.options);
  return null;
};

/** A readable correct answer for review screens, reports and answer keys. */
export const correctAnswerText = (question) => {
  const value = decodeStoredValue(question.correct_answer);
  switch (question.question_type) {
    case "multiple_choice":
      return canonicalOption(value, question.options) ?? String(value ?? "");
    case "true_false":
      return String(parseBoolean(value));
    case "short_answer":
      return parseShortAnswerRule(value).answer || "";
    case "fill_blank":
      return parseBlankRule(value)
        .map((accepted, i) => `(${i + 1}) ${accepted.join(" / ")}`)
        .join("  ");
    case "matching": {
      const { left } = matchingOptions(question.options);
      const { pairs } = parseMatchingRule(value);
      return left.map((l, i) => `${l} → ${pairs[i] ?? ""}`).join("; ");
    }
    default:
      return String(value ?? "");
  }
};

// ---------------------------------------------------------------- Review

/**
 * Shape one question for a review screen (student or instructor) using the
 * same grading function as submission, so the screens always agree with the score.
 * `row` needs question_type, options, correct_answer, student_answer and marks.
 */
export const toReviewItem = (row) => {
  const { answered, correct, score, fraction } = gradeAnswer(row, row.student_answer);
  const structured = STRUCTURED_TYPES.includes(row.question_type);
  return {
    question_order: row.question_order,
    question_type: row.question_type,
    question_text: row.question_text,
    options: questionOptions(row),
    correct_answer: decodeStoredValue(row.correct_answer),
    correct_answer_text: correctAnswerText(row),
    student_answer: structured ? decodeStoredValue(row.student_answer) ?? null : row.student_answer ?? null,
    answered,
    is_correct: correct,
    fraction,
    score,
    positive_marks: Number(row.positive_marks),
    negative_marks: Number(row.negative_marks),
  };
};
