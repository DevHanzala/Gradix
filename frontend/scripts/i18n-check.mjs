#!/usr/bin/env node
/**
 * i18n check (run by `npm run lint`):
 *  1. en, ur and ar have exactly the same keys; fa has every key of the
 *     REQUIRED_FA areas (exam, results, reports, ...) and no unknown keys.
 *  2. Every translation uses the same {{placeholders}} as English.
 *  3. Every static key passed to t("...") / i18nKey="..." exists in English.
 *  4. No hard-coded user-facing text in src (JSX text, user-facing attributes,
 *     toast/errorMessage literals, label/title/text/message fields).
 *     Silence a deliberate exception with a trailing `// i18n-ignore`
 *     (or `{/* i18n-ignore *\/}` in JSX) on that line.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localesDir = path.join(root, "src", "locales");
const LANGS = ["en", "ur", "ar", "fa"];
const FULL = ["en", "ur", "ar"];
const REQUIRED_FA = ["common", "errors", "validation", "exam", "results", "reports", "status", "nav", "roles"];
const problems = [];

// ---------------------------------------------------------------- catalogs
const flatten = (node, prefix = "", out = {}) => {
  for (const [k, v] of Object.entries(node)) {
    if (v && typeof v === "object") flatten(v, `${prefix}${k}.`, out);
    else out[`${prefix}${k}`] = String(v);
  }
  return out;
};
const catalogs = {};
for (const lang of LANGS) {
  catalogs[lang] = {};
  const dir = path.join(localesDir, lang);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const area = file.replace(/\.json$/, "");
    try {
      Object.assign(catalogs[lang], flatten(JSON.parse(readFileSync(path.join(dir, file), "utf8")), `${area}.`));
    } catch (error) {
      problems.push(`${lang}/${file}: invalid JSON (${error.message})`);
    }
  }
}
const en = catalogs.en;
const enKeys = Object.keys(en);
for (const lang of LANGS.filter((l) => l !== "en")) {
  const keys = Object.keys(catalogs[lang]);
  for (const key of keys) if (!(key in en)) problems.push(`${lang}: unknown key "${key}" (not in en)`);
  for (const key of enKeys) {
    const area = key.split(".")[0];
    const required = FULL.includes(lang) || REQUIRED_FA.includes(area);
    if (required && !(key in catalogs[lang])) problems.push(`${lang}: missing "${key}"`);
  }
  const placeholders = (s) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(",");
  const tags = (s) => [...s.matchAll(/<(\w+)>/g)].map((m) => m[1]).sort().join(",");
  for (const key of keys) {
    if (!(key in en)) continue;
    if (placeholders(catalogs[lang][key]) !== placeholders(en[key])) problems.push(`${lang}: placeholders differ for "${key}"`);
    if (tags(catalogs[lang][key]) !== tags(en[key])) problems.push(`${lang}: <tags> differ for "${key}"`);
    if (!catalogs[lang][key].trim()) problems.push(`${lang}: empty translation for "${key}"`);
  }
}

// ------------------------------------------------------------- source scan
const sources = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== "locales") walk(full);
    } else if (/\.(jsx?|tsx?)$/.test(name)) sources.push(full);
  }
};
walk(path.join(root, "src"));

const ATTRS = "label|title|description|placeholder|hint|aria-label|alt|confirmText|cancelText|backLabel|subtitle|caption|legend";
const rules = [
  // <p>Some words</p> on one line
  { re: />\s*([A-Za-z][^<>{}]*[A-Za-z]{2,}[^<>{}]*?)\s*</g, jsxOnly: true, what: "JSX text" },
  { re: new RegExp(`\\b(?:${ATTRS})="([^"]*[A-Za-z]{2,}[^"]*)"`, "g"), jsxOnly: true, what: "attribute" },
  { re: /\b(?:toast(?:\.\w+)?|errorMessage|alert|confirm)\([^)]*?(["'`])([A-Z][a-z][^"'`]*)\1/g, what: "message literal", group: 2 },
  { re: /\b(?:label|title|text|message|description|subtitle|hint):\s*(["'`])([A-Z][a-z][^"'`]*\s[^"'`]*)\1/g, what: "label literal", group: 2 },
];
const ALLOWED_TEXT = /^(Gradix|Google|OK)$/;
const usedKeys = new Set();

for (const file of sources) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const isJsx = file.endsWith("x");
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  let inBlockComment = false;
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("/*")) inBlockComment = true;
    const commentLine = inBlockComment || trimmed.startsWith("//") || trimmed.startsWith("*");
    if (trimmed.includes("*/")) inBlockComment = false;

    for (const m of line.matchAll(/\b(?:t|tUi|tChosen)\(\s*["']([\w.-]+)["']/g)) usedKeys.add(m[1]);
    for (const m of line.matchAll(/i18nKey=["']([\w.-]+)["']/g)) usedKeys.add(m[1]);

    if (commentLine || /i18n-ignore/.test(line) || /i18n-ignore/.test(lines[i - 1] || "")) return;
    for (const rule of rules) {
      if (rule.jsxOnly && !isJsx) continue;
      for (const m of line.matchAll(rule.re)) {
        const text = (m[rule.group || 1] || "").trim();
        if (!text || ALLOWED_TEXT.test(text)) continue;
        if (/^[\w-]+(\.[\w-]+)+$/.test(text)) continue; // an i18n key
        if (/^(https?:|\/|#)/.test(text)) continue;
        if (/[()=&|]|\.\w+\(|\.length/.test(text)) continue; // code between < and >, not text
        problems.push(`${rel}:${i + 1}: hard-coded ${rule.what}: "${text.slice(0, 60)}"`);
      }
    }
    // Multi-line JSX text: a line that is only words, inside a .jsx file.
    if (isJsx && /^[A-Z][a-z’']+(?:[ ,][A-Za-z’'()-]+){2,}[.!?…:]?$/.test(trimmed) && !/[=;{}]/.test(trimmed)) {
      problems.push(`${rel}:${i + 1}: hard-coded JSX text: "${trimmed.slice(0, 60)}"`);
    }
  });
}
for (const key of usedKeys) if (!(key in en)) problems.push(`t("${key}") is used but missing in en`);

if (problems.length) {
  console.error(`i18n check failed (${problems.length} problem${problems.length === 1 ? "" : "s"}):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`i18n check passed: ${enKeys.length} keys, ${sources.length} files scanned.`);
