import { createHash } from "crypto";
import {
  normalizeOptions,
  normalizeText,
  canonicalOptionIndex,
  parseBoolean,
  parseShortAnswerRule,
} from "../../utils/grading.js";

/**
 * Validation of AI-generated questions. A question that fails any rule is
 * discarded and regenerated; it is never shown to a student.
 *
 * Rules (all types): non-empty stem; stem written in the requested language's
 * script. MCQ: required number of options, all distinct after normalisation,
 * exactly one correct answer that matches an option. True/false: a
 * recognisable boolean. Short answer: a model answer or keywords. No leak: the
 * correct answer must not appear verbatim in the stem.
 */
export const QUESTION_TYPES = ["multiple_choice", "true_false", "short_answer"];
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

  return fail("unknown_type");
};
