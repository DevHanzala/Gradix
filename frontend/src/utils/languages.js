/** Languages of the app and of assessments (Persian is optional for instructors). */
export const LANGUAGES = [
  { code: "en", name: "English", dir: "ltr" },
  { code: "ur", name: "اردو", dir: "rtl" },
  { code: "ar", name: "العربية", dir: "rtl" },
  { code: "fa", name: "فارسی", dir: "rtl" },
  // Sindhi: interface language only (exams are in en/ur/ar/fa); translations await native review.
  { code: "sd", name: "سنڌي", dir: "rtl", uiOnly: true },
];
export const LANGUAGE_NAMES = { en: "English", ur: "اردو · Urdu", ar: "العربية · Arabic", fa: "فارسی · Persian", sd: "سنڌي · Sindhi" };
export const RTL_LANGUAGES = ["ur", "ar", "fa", "sd"];
export const isRtl = (code) => RTL_LANGUAGES.includes(code);

/** Intl locales per UI language. */
export const LOCALES = { en: "en-GB", ur: "ur-PK", ar: "ar", fa: "fa-IR", sd: "sd-PK" };
