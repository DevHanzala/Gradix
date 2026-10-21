import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { LANGUAGES, isRtl } from "../utils/languages.js";

const STORAGE_KEY = "gradix.language";
const CODES = LANGUAGES.map((l) => l.code);

const readStored = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const detect = () => {
  const stored = readStored();
  if (CODES.includes(stored)) return stored;
  const preferred = (typeof navigator !== "undefined" ? navigator.languages || [navigator.language] : [])
    .map((l) => String(l || "").slice(0, 2).toLowerCase())
    .find((l) => CODES.includes(l));
  return preferred || "en";
};

/** <html lang dir> follow the UI language (fonts and RTL layout key off them). */
const applyDocumentLanguage = (code) => {
  if (typeof document === "undefined") return;
  document.documentElement.lang = code;
  document.documentElement.dir = isRtl(code) ? "rtl" : "ltr";
};

/**
 * Catalogs: src/locales/<language>/<area>.json, merged into one namespace with
 * the area as the top-level key (t("exam.start") lives in exam.json -> "start").
 */
const files = import.meta.glob("../locales/*/*.json", { eager: true, import: "default" });
const resources = {};
for (const [path, catalog] of Object.entries(files)) {
  const [, language, area] = path.match(/locales\/([a-z]{2})\/([\w-]+)\.json$/);
  resources[language] ??= { translation: {} };
  resources[language].translation[area] = catalog;
}

i18n.use(initReactI18next).init({
  resources,
  lng: detect(),
  fallbackLng: "en",
  supportedLngs: CODES,
  interpolation: { escapeValue: false }, // React escapes
  returnNull: false,
});

applyDocumentLanguage(i18n.language);
i18n.on("languageChanged", (code) => {
  applyDocumentLanguage(code);
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Private mode: the choice still applies to this session.
  }
});

export default i18n;
