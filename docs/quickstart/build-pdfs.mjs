/**
 * Build the quick-start PDFs from the Markdown guides in this folder, with the app's own
 * PDF renderer and embedded Noto fonts (Urdu in Nastaliq).   node docs/quickstart/build-pdfs.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const backend = path.join(here, "..", "..", "backend");
const imp = (rel) => import(pathToFileURL(path.join(backend, rel)).href);
const { pdfRenderer } = await imp("helper/pdfRenderer.js");
const { pdfFontCss } = await imp("helper/pdfFonts.js");

const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s) => escape(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
const toHtml = (md) => {
  const out = [];
  let list = false;
  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    const close = () => list && (out.push("</ul>"), (list = false));
    if (line.startsWith("# ")) (close(), out.push(`<h1>${inline(line.slice(2))}</h1>`));
    else if (line.startsWith("## ")) (close(), out.push(`<h2>${inline(line.slice(3))}</h2>`));
    else if (line.startsWith("- ")) (list || (out.push("<ul>"), (list = true)), out.push(`<li>${inline(line.slice(2))}`));
    else if (line.startsWith("  ") && list) out.push(` ${inline(line.trim())}`);
    else if (!line.trim()) close();
    else (close(), out.push(`<p>${inline(line)}</p>`));
  }
  if (list) out.push("</ul>");
  return out.join("\n");
};

for (const file of fs.readdirSync(here).filter((f) => f.endsWith(".md"))) {
  const language = file.endsWith("-ur.md") ? "ur" : "en";
  const fonts = pdfFontCss(language);
  const html = `<!DOCTYPE html><html lang="${language}" dir="${language === "ur" ? "rtl" : "ltr"}"><head><meta charset="UTF-8"/><style>
    ${fonts.css}
    body { font-family: ${fonts.family}; line-height: ${fonts.lineHeight}; font-size: 10.5pt; color: #111827; }
    h1 { font-size: 17pt; color: #3730a3; margin: 0 0 6px; } h2 { font-size: 12pt; margin: 12px 0 4px; color: #1f2937; }
    ul { margin: 0; padding-inline-start: 18px; } li { margin-bottom: 3px; } p { margin: 10px 0 0; color: #4b5563; }
  </style></head><body>${toHtml(fs.readFileSync(path.join(here, file), "utf8"))}</body></html>`;
  const pdf = await pdfRenderer.render(html);
  fs.writeFileSync(path.join(here, file.replace(".md", ".pdf")), pdf);
  console.log(`${file.replace(".md", ".pdf")}: ${Math.round(pdf.length / 1024)} KB`);
}
