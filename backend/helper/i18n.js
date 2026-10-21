import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Server-side translations (emails, notifications). Catalogs live in
 * backend/locales/<lang>.json; a missing key falls back to English.
 */
export const LANGUAGES = ["en", "ur", "ar", "fa"];
export const RTL_LANGUAGES = ["ur", "ar", "fa"];
const LOCALES = { en: "en-GB", ur: "ur-PK", ar: "ar", fa: "fa-IR" };

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "locales");
const catalogs = Object.fromEntries(LANGUAGES.map((l) => [l, JSON.parse(readFileSync(path.join(dir, `${l}.json`), "utf8"))]));

export const normalizeLanguage = (language) => (LANGUAGES.includes(language) ? language : "en");

const lookup = (catalog, key) =>
  key.split(".").reduce((node, part) => (node && typeof node === "object" ? node[part] : undefined), catalog);

/** translate("ur", "email.verify.subject", { name }) — "{{name}}" placeholders are replaced. */
export const translate = (language, key, params = {}) => {
  const template = lookup(catalogs[normalizeLanguage(language)], key) ?? lookup(catalogs.en, key) ?? key;
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, name) => String(params[name] ?? ""));
};

export const isRtl = (language) => RTL_LANGUAGES.includes(normalizeLanguage(language));

/** Date + time in the recipient's locale (UTC, labelled). */
export const formatDateTime = (language, date = new Date()) =>
  `${new Intl.DateTimeFormat(LOCALES[normalizeLanguage(language)], {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date)} UTC`;

/** Every key of a catalog (used by the i18n check). */
export const catalogKeys = (language) => {
  const keys = [];
  const walk = (node, prefix) => {
    for (const [k, v] of Object.entries(node)) {
      if (v && typeof v === "object") walk(v, `${prefix}${k}.`);
      else keys.push(`${prefix}${k}`);
    }
  };
  walk(catalogs[language], "");
  return keys.sort();
};
