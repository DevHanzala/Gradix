/** Languages of the app and of assessments (Persian is optional for instructors). */
export const LANGUAGES = [
  { code: "en", name: "English", dir: "ltr" },
  { code: "ur", name: "اردو", dir: "rtl" },
  { code: "ar", name: "العربية", dir: "rtl" },
  { code: "fa", name: "فارسی", dir: "rtl" },
];
export const LANGUAGE_NAMES = { en: "English", ur: "اردو · Urdu", ar: "العربية · Arabic", fa: "فارسی · Persian" };
export const RTL_LANGUAGES = ["ur", "ar", "fa"];
export const isRtl = (code) => RTL_LANGUAGES.includes(code);

/** Intl locales per UI language. */
export const LOCALES = { en: "en-GB", ur: "ur-PK", ar: "ar", fa: "fa-IR" };
