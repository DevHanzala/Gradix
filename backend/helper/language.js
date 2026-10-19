/**
 * Lightweight script-based language detection for source material.
 * Good enough to label resources and pick OCR/fallback paths; not a general
 * language identifier.
 */
const ARABIC_SCRIPT = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-ﻼ]/gu;
const LATIN = /[A-Za-zÀ-ɏ]/gu;
// Letters used by Urdu but not by Arabic/Persian.
const URDU_ONLY = /[ٹڈڑںھہے]/gu; // ٹ ڈ ڑ ں ھ ہ ے
// Letters used by Persian (and Urdu) but not by Arabic.
const PERSIAN_LETTERS = /[پچژگکی]/gu; // پ چ ژ گ ک ی

const count = (text, rx) => (text.match(rx) || []).length;

/** Returns "en" | "ur" | "ar" | "fa" | "und". */
export const detectLanguage = (text) => {
  const sample = String(text || "").slice(0, 20000);
  const arabicScript = count(sample, ARABIC_SCRIPT);
  const latin = count(sample, LATIN);
  if (arabicScript === 0 && latin === 0) return "und";
  if (latin >= arabicScript) return "en";
  if (count(sample, URDU_ONLY) / arabicScript > 0.01) return "ur";
  if (count(sample, PERSIAN_LETTERS) / arabicScript > 0.01) return "fa";
  return "ar";
};

export const isRtlLanguage = (language) => ["ur", "ar", "fa"].includes(language);
