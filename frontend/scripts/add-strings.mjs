/**
 * Developer tool: merge new UI strings into the locale files.
 *
 *   node scripts/add-strings.mjs <file.json>
 *
 * <file.json> is { "<lang>": { "<area>": { ...keys } } }; each area is merged into
 * src/locales/<lang>/<area>.json (nested objects merged, given keys overwritten).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "locales");
const updates = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const merge = (a, b) => {
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object") merge(a[k], v);
    else a[k] = v;
  }
  return a;
};
for (const [lang, areas] of Object.entries(updates)) {
  fs.mkdirSync(path.join(dir, lang), { recursive: true });
  for (const [area, values] of Object.entries(areas)) {
    const file = path.join(dir, lang, `${area}.json`);
    const current = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
    fs.writeFileSync(file, `${JSON.stringify(merge(current, values), null, 2)}\n`);
  }
  console.log(`${lang}: ${Object.keys(areas).join(", ")}`);
}
