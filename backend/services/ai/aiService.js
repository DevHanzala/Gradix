export const mapLanguageCode = (lang) => {
  const map = {
    en: "English",
    ur: "Urdu",
    ar: "Arabic",
    fa: "Persian",
  };

  return map[lang] || "English";
};
