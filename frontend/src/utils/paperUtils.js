/**
 * Safe download file name that keeps letters from any script (Urdu, Arabic…),
 * digits, dashes and underscores.
 */
export const sanitizeFileName = (fileName) => {
  const cleaned = String(fileName || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}_-]/gu, "");
  return cleaned || "assessment";
};
