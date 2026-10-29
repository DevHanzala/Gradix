import { createHash } from "crypto";
import {
  normalizeOptions,
  normalizeText,
  canonicalOptionIndex,
  parseBoolean,
  parseShortAnswerRule,
  blankCount,
  BLANK_MARKER,
} from "../../utils/grading.js";

/**
 * Validation of AI-generated questions. A question that fails any rule is
 * discarded and regenerated; it is never shown to a student.
 *
 * Rules (all types): non-empty stem; stem written in the requested language's
 * script. MCQ: required number of options, all distinct after normalisation,
 * exactly one correct answer that matches an option. True/false: a
 * recognisable boolean. Short answer: a model answer or keywords. Fill in the
 * blank: 1-5 numbered blanks [[1]].. in order, each with at least one accepted
 * answer. Matching: 3-6 pairs, all sides distinct. No leak: the correct answer
 * must not appear verbatim in the stem.
 */
export const QUESTION_TYPES = ["multiple_choice", "true_false", "short_answer", "fill_blank", "matching"];
export const FILL_BLANK_LIMITS = { min: 1, max: 5 };
export const MATCHING_LIMITS = { min: 3, max: 6 };
export const LANGUAGES = ["en", "ur", "ar", "fa"];
const ARABIC_SCRIPT = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-ﻼ]/gu;
const LATIN = /[A-Za-zÀ-ɏ]/gu;
/** Shorter answers ("Paris", "4") can legitimately appear in a stem. */
const LEAK_MIN_CHARS = 12;

export const stemHash = (text) => createHash("sha256").update(normalizeText(text)).digest("hex");

/** True when the text is written in the script expected for `language`. */
export const matchesLanguage = (text, language) => {
  const arabic = (String(text).match(ARABIC_SCRIPT) || []).length;
  const latin = (String(text).match(LATIN) || []).length;
  if (arabic + latin === 0) return true; // numbers/symbols only: nothing to judge
  return language === "en" ? latin >= arabic : arabic > latin;
};

const leaks = (stem, answerText) => {
  const answer = normalizeText(answerText);
  return answer.length >= LEAK_MIN_CHARS && normalizeText(stem).includes(answer);
};

/**
 * Validate one raw question against a request.
 * @param raw  {question_text, options, correct_answer, ...} from the model
 * @param spec {question_type, language, num_options}
 * @returns {{ ok: true, question } | { ok: false, reason }}
 */
export const validateQuestion = (raw, spec) => {
  const fail = (reason) => ({ ok: false, reason });
  if (!raw || typeof raw.question_text !== "string" || !raw.question_text.trim()) return fail("empty_stem");
  const stem = raw.question_text.trim();
  if (!matchesLanguage(stem, spec.language)) return fail("wrong_language");

  if (spec.question_type === "multiple_choice") {
    const options = normalizeOptions(raw.options).filter((o) => o.length > 0);
    const wanted = Number(spec.num_options) || 4;
    if (options.length !== wanted) return fail("option_count");
    if (new Set(options.map(normalizeText)).size !== options.length) return fail("duplicate_options");
    if (Array.isArray(raw.correct_answer)) return fail("multiple_correct");
    const index = canonicalOptionIndex(raw.correct_answer, options);
    if (index === null) return fail("answer_not_an_option");
    if (!options.every((o) => matchesLanguage(o, spec.language))) return fail("wrong_language");
    if (leaks(stem, options[index])) return fail("answer_in_stem");
    return { ok: true, question: { question_text: stem, options, correct_answer: options[index] } };
  }

  if (spec.question_type === "true_false") {
    const correct = parseBoolean(raw.correct_answer);
    if (correct === null) return fail("answer_not_boolean");
    return { ok: true, question: { question_text: stem, options: null, correct_answer: correct } };
  }

  if (spec.question_type === "short_answer") {
    const rule = parseShortAnswerRule(raw.correct_answer);
    if (!rule.answer && rule.concepts.length === 0) return fail("no_answer");
    if (rule.answer && leaks(stem, rule.answer)) return fail("answer_in_stem");
    return {
      ok: true,
      question: {
        question_text: stem,
        options: null,
        correct_answer: {
          answer: rule.answer,
          // AI rubric: concepts a correct answer must contain, each with accepted phrasings.
          rubric: rule.concepts.map(([concept, ...accept]) => ({ concept, accept })),
          required_keywords: rule.keywords,
          min_required_match: rule.concepts.length ? Math.max(1, rule.minMatch) : 0,
        },
      },
    };
  }

  if (spec.question_type === "fill_blank") {
    const markers = [...stem.matchAll(BLANK_MARKER)].map((m) => Number(m[1]));
    const count = blankCount(stem);
    if (count < FILL_BLANK_LIMITS.min || count > FILL_BLANK_LIMITS.max) return fail("blank_count");
    // Blanks are numbered 1..n, each used once.
    if (markers.length !== count || markers.some((n, i) => n !== i + 1)) return fail("blank_numbering");
    const source = raw.correct_answer?.blanks ?? raw.correct_answer;
    const blanks = (Array.isArray(source) ? source : []).map((accepted) =>
      [...new Set([].concat(accepted ?? []).map((a) => String(a).trim()).filter((a) => normalizeText(a)))].slice(0, 8)
    );
    if (blanks.length !== count || blanks.some((accepted) => accepted.length === 0)) return fail("blank_answers");
    if (!blanks.every((accepted) => accepted.every((a) => matchesLanguage(a, spec.language)))) return fail("wrong_language");
    // The text around the blanks must not already contain the answer.
    const visible = stem.replace(BLANK_MARKER, " ");
    if (blanks.some((accepted) => accepted.some((a) => normalizeText(a).length >= 3 && normalizeText(visible).split(" ").includes(normalizeText(a))))) {
      return fail("answer_in_stem");
    }
    return { ok: true, question: { question_text: stem, options: null, correct_answer: { blanks } } };
  }

  if (spec.question_type === "matching") {
    // Pairs from the model or editor ([[left, right], ...]), or a stored question: left column + correct pairs.
    const storedPairs = raw.correct_answer?.pairs;
    const rawPairs = Array.isArray(raw.pairs)
      ? raw.pairs
      : Array.isArray(raw.options?.left) && storedPairs && typeof storedPairs === "object"
        ? raw.options.left.map((l, i) => [l, storedPairs[i]])
        : [];
    const pairs = rawPairs
      .map((p) => (Array.isArray(p) ? p : [p?.left, p?.right]).map((x) => String(x ?? "").trim()))
      .filter(([l, r]) => l && r);
    const wanted = Number(spec.num_options) || 4;
    if (pairs.length < MATCHING_LIMITS.min || pairs.length > MATCHING_LIMITS.max) return fail("pair_count");
    if (spec.num_options && pairs.length !== wanted) return fail("pair_count");
    const lefts = pairs.map(([l]) => normalizeText(l));
    const rights = pairs.map(([, r]) => normalizeText(r));
    if (new Set(lefts).size !== lefts.length || new Set(rights).size !== rights.length) return fail("duplicate_options");
    if (!pairs.every(([l, r]) => matchesLanguage(l, spec.language) && matchesLanguage(r, spec.language))) return fail("wrong_language");
    return { ok: true, question: buildMatching(stem, pairs, raw.correct_answer?.partial_credit !== false) };
  }

  return fail("unknown_type");
};

/**
 * A matching question from [left, right] pairs: the right column is shuffled for
 * display (so its order never gives the answer away) and the pairs are kept in
 * correct_answer.
 */
export const buildMatching = (stem, pairs, partialCredit = true) => {
  const right = pairs.map(([, r]) => r);
  for (let i = right.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [right[i], right[j]] = [right[j], right[i]];
  }
  // Never leave every item opposite its own match.
  if (right.length > 1 && right.every((r, i) => r === pairs[i][1])) right.push(right.shift());
  return {
    question_text: stem,
    options: { left: pairs.map(([l]) => l), right },
    correct_answer: { pairs: Object.fromEntries(pairs.map(([, r], i) => [i, r])), partial_credit: partialCredit },
  };
};
