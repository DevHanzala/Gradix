/** Languages every Phase 1 (no-objectives) assessment can be generated in. */
export const ALL_LANGUAGES = ["en", "ur", "ar", "fa"];

/**
 * Languages a student may start an assessment in right now.
 * Pool assessments: languages whose pool is ready. Phase 1 assessments: any,
 * once published. Unpublished: none.
 */
export const availableLanguages = ({ assessment_status: status, uses_pool: usesPool, ready_languages: ready, languages }) => {
  if (!["publishing", "published"].includes(status)) return [];
  if (!usesPool) return ALL_LANGUAGES;
  const offered = new Set(languages || []);
  return (ready || []).filter((l) => offered.has(l));
};
