import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Embedded fonts for server-rendered PDFs (papers, reports):
 * Urdu is set in Noto Nastaliq Urdu, Arabic and Persian in Noto Naskh Arabic
 * (SIL OFL, backend/fonts). Fonts are inlined as data URLs so Chromium never
 * needs network access.
 */
const fontsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fonts");
const FILES = { nastaliq: "NotoNastaliqUrdu.ttf", naskh: "NotoNaskhArabic.ttf" };
const cache = {};
const dataUrl = (key) => {
  cache[key] ??= `data:font/ttf;base64,${fs.readFileSync(path.join(fontsDir, FILES[key])).toString("base64")}`;
  return cache[key];
};

/** CSS @font-face rules plus the font-family stack and line height for `language`. */
export const pdfFontCss = (language) => {
  const css = `
    @font-face { font-family: 'Noto Nastaliq Urdu'; src: url(${dataUrl("nastaliq")}) format('truetype'); font-weight: 400 700; }
    @font-face { font-family: 'Noto Naskh Arabic'; src: url(${dataUrl("naskh")}) format('truetype'); font-weight: 400 700; }`;
  const family =
    language === "ur"
      ? "'Noto Nastaliq Urdu', 'Noto Naskh Arabic', serif"
      : ["ar", "fa"].includes(language)
        ? "'Noto Naskh Arabic', serif"
        : "Arial, Helvetica, sans-serif";
  return { css, family, lineHeight: language === "ur" ? 2.2 : ["ar", "fa"].includes(language) ? 1.8 : 1.5 };
};
