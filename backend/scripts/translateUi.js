import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { listCreationKeys } from "../services/ai/aiProviders.js";

dotenv.config();

/**
 * Developer tool: fill MISSING UI strings of a language from English with Gemini.
 *
 *   node scripts/translateUi.js <lang> [--backend]
 *
 * Frontend: frontend/src/locales/en/*.json -> frontend/src/locales/<lang>/*.json
 * --backend: backend/locales/en.json -> backend/locales/<lang>.json (emails, PDF reports)
 * Existing translations are never overwritten. Every {{placeholder}} must survive, or the
 * string is skipped. Filled keys are listed in docs/translation-review-<lang>.md for native review.
 * Uses the first Gemini key from the environment (never printed).
 */
const LANGUAGE_NAMES = { ur: "Urdu", ar: "Modern Standard Arabic", fa: "Persian (Farsi)", sd: "Sindhi (Arabic script, as used in Sindh, Pakistan)" };
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const lang = process.argv[2];
const backendMode = process.argv.includes("--backend");
if (!LANGUAGE_NAMES[lang]) {
  console.error(`Usage: node scripts/translateUi.js <${Object.keys(LANGUAGE_NAMES).join("|")}> [--backend]`);
  process.exit(1);
}
// Every Gemini key in the environment (never printed); on a 429 the next one is used.
const keys = listCreationKeys().filter((k) => k.type === "gemini").map((k) => k.secret);
if (!keys.length) {
  console.error("No Gemini key in the environment.");
  process.exit(1);
}
let keyIndex = 0;
const client = () => new GoogleGenAI({ apiKey: keys[keyIndex % keys.length] });

const flatten = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]));
const setPath = (obj, dotted, value) => {
  const parts = dotted.split(".");
  let node = obj;
  for (const p of parts.slice(0, -1)) node = node[p] && typeof node[p] === "object" ? node[p] : (node[p] = {});
  node[parts.at(-1)] = value;
};
const placeholders = (s) => [...String(s).matchAll(/\{\{\s*[\w.]+\s*\}\}/g)].map((m) => m[0].replace(/\s/g, "")).sort().join("|");

const translateBatch = async (entries, area) => {
  const prompt = `Translate these user-interface strings of "Gradix", an exam and live-quiz app for schools, from English into ${LANGUAGE_NAMES[lang]}.
Rules: natural, simple wording a teacher or student would use; keep every {{placeholder}} exactly as written; keep "Gradix", "AI", "PDF", "CSV", "QR", "Word", "Excel", "Gemini", "Groq", URLs and email addresses unchanged; keep punctuation style (· / …); do not add explanations.
Area: ${area}
Return ONLY a JSON object mapping each key to its translation.
${JSON.stringify(Object.fromEntries(entries), null, 1)}`;
  let response;
  for (let tried = 0; tried < keys.length; tried++) {
    try {
      response = await client().models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 8000, thinkingConfig: { thinkingBudget: 0 } },
      });
      break;
    } catch (error) {
      if (error.status !== 429 || tried === keys.length - 1) throw error;
      keyIndex += 1; // rate-limited: next key
    }
  }
  // Models sometimes nest dotted keys ({ tour: { student: ... } }); flatten them back.
  return Object.fromEntries(flatten(JSON.parse(response.text)));
};

const review = [];
const fill = async (english, target, area) => {
  const missing = flatten(english).filter(([k, v]) => typeof v === "string" && flatten(target).every(([tk]) => tk !== k));
  for (let i = 0; i < missing.length; i += 40) {
    const batch = missing.slice(i, i + 40);
    let out = {};
    for (let attempt = 1; attempt <= 3 && !Object.keys(out).length; attempt++) {
      try {
        out = await translateBatch(batch, area);
      } catch (error) {
        console.warn(`  ${area}: batch failed (${error.message.slice(0, 80)}), retry ${attempt}`);
        await new Promise((r) => setTimeout(r, 4000 * attempt));
      }
    }
    for (const [k, en] of batch) {
      const value = out[k];
      if (typeof value !== "string" || !value.trim() || placeholders(value) !== placeholders(en)) {
        console.warn(`  skipped ${area}:${k} (missing or placeholders changed)`);
        continue;
      }
      setPath(target, k, value.trim());
      review.push(`| ${area} | \`${k}\` | ${String(en).replace(/\|/g, "\\|")} | ${value.trim().replace(/\|/g, "\\|")} |`);
    }
    await new Promise((r) => setTimeout(r, 6500)); // stay under the free per-minute limit
  }
  return target;
};

if (backendMode) {
  const dir = path.join(root, "backend", "locales");
  const english = JSON.parse(fs.readFileSync(path.join(dir, "en.json"), "utf8"));
  const file = path.join(dir, `${lang}.json`);
  const target = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  fs.writeFileSync(file, `${JSON.stringify(await fill(english, target, "backend"), null, 2)}\n`);
} else {
  const dir = path.join(root, "frontend", "src", "locales");
  fs.mkdirSync(path.join(dir, lang), { recursive: true });
  for (const name of fs.readdirSync(path.join(dir, "en")).filter((f) => f.endsWith(".json")).sort()) {
    const english = JSON.parse(fs.readFileSync(path.join(dir, "en", name), "utf8"));
    const file = path.join(dir, lang, name);
    const target = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
    const before = flatten(target).length;
    await fill(english, target, name.replace(".json", ""));
    fs.writeFileSync(file, `${JSON.stringify(target, null, 2)}\n`);
    console.log(`${lang}/${name}: ${flatten(target).length - before} filled`);
  }
}

const reviewFile = path.join(root, "docs", `translation-review-${lang}.md`);
const header = `# Machine-filled ${LANGUAGE_NAMES[lang]} strings (needs native review)\n\nFilled from English by scripts/translateUi.js. Please check each line and correct it in the locale files.\n\n| Area | Key | English | ${LANGUAGE_NAMES[lang]} |\n|---|---|---|---|\n`;
const existing = fs.existsSync(reviewFile) ? fs.readFileSync(reviewFile, "utf8") : header;
fs.writeFileSync(reviewFile, existing + (review.length ? `${review.join("\n")}\n` : ""));
console.log(`${review.length} strings filled; review list: docs/translation-review-${lang}.md`);
