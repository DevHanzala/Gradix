/** Assessment languages (Persian is optional for instructors). */
export const LANGUAGE_NAMES = { en: "English", ur: "اردو · Urdu", ar: "العربية · Arabic", fa: "فارسی · Persian" };
export const RTL_LANGUAGES = ["ur", "ar", "fa"];
export const isRtl = (code) => RTL_LANGUAGES.includes(code);
