/**
 * Decide whether extracted text is usable source material.
 *
 * Phase 2 rule: accept short legitimate texts (a short surah, a poem, a
 * one-page note); reject only empty text or OCR garbage. Garbage OCR shows
 * up as mostly symbols/digits, or as a soup of 1-character "words".
 */
export const QUALITY_RULES = {
  minWords: 3,
  minLetters: 12,
  minWordCharRatio: 0.6, // (letters + digits) / non-space characters
  minLetterRatio: 0.3, // letters / non-space characters
  maxSingleCharWordRatio: 0.5,
};

/** @returns {{ ok: true } | { ok: false, reason: "empty" | "too_short" | "garbage" }} */
export const assessTextQuality = (text, rules = QUALITY_RULES) => {
  const clean = String(text || "").trim();
  if (!clean) return { ok: false, reason: "empty" };

  const words = clean.split(/\s+/u).filter(Boolean);
  const nonSpace = clean.replace(/\s+/gu, "");
  const letters = (nonSpace.match(/\p{L}|\p{M}/gu) || []).length;

  if (letters === 0) return { ok: false, reason: "garbage" };
  if (words.length < rules.minWords || letters < rules.minLetters) return { ok: false, reason: "too_short" };
  const digits = (nonSpace.match(/\p{N}/gu) || []).length;
  if ((letters + digits) / nonSpace.length < rules.minWordCharRatio) return { ok: false, reason: "garbage" };
  if (letters / nonSpace.length < rules.minLetterRatio) return { ok: false, reason: "garbage" };

  const singleChar = words.filter((w) => (w.match(/\p{L}/gu) || []).length <= 1).length;
  if (singleChar / words.length > rules.maxSingleCharWordRatio) return { ok: false, reason: "garbage" };

  return { ok: true };
};
