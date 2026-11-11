import path from "path";
import { fileURLToPath } from "url";
import { AppError } from "../utils/AppError.js";
import { assessTextQuality } from "./textQuality.js";
import { generateContent } from "../services/ai/generateContent.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Local Tesseract language data shipped in assets/tessdata (uncompressed). */
export const TESSDATA_DIR = path.join(__dirname, "..", "assets", "tessdata");
const OCR_LANGUAGES = ["eng", "ara", "urd", "fas"];
// Heavy libraries are loaded on first use only (memory on a 512 MB server).
const loadPdfParse = async () => (await import("pdf-parse/lib/pdf-parse.js")).default;
const loadTesseract = async () => (await import("tesseract.js")).createWorker;
const loadOffice = async () => (await import("office-text-extractor")).getTextExtractor;

/**
 * OCR provider (OCR_PROVIDER): "tesseract" (development default, runs locally) or
 * "gemini" (production default when NODE_ENV=production: Gemini vision, no 100+ MB
 * Tesseract worker in memory). The other one is the fallback when the first fails or
 * reads nothing usable. OCR_GEMINI_FALLBACK=true keeps the old behaviour of allowing
 * Gemini as the fallback in development; it sends the document to Google either way.
 */
export const ocrProvider = () =>
  (process.env.OCR_PROVIDER || (process.env.NODE_ENV === "production" ? "gemini" : "tesseract")).toLowerCase() === "gemini" ? "gemini" : "tesseract";

export const ocrFallback = {
  enabled: () => ocrProvider() === "gemini" || String(process.env.OCR_GEMINI_FALLBACK || "").toLowerCase() === "true",
  transcribe: async (images) => {
    const parts = images.map((buffer) => ({ mimeType: "image/png", data: Buffer.from(buffer).toString("base64") }));
    return generateContent(
      "Transcribe ALL text in these document images exactly as written, in its original language and script " +
        "(English, Urdu, Arabic or Persian). Keep paragraph breaks. Output only the text, no commentary.",
      { purpose: "ocr_fallback", images: parts, maxOutputTokens: 8000, temperature: 0 }
    );
  },
};
/** Scanned PDFs are OCR'd page by page; cap the work per upload. */
export const MAX_OCR_PAGES = 20;
/** A PDF whose text layer is shorter than this is treated as scanned. */
const MIN_PDF_TEXT_CHARS = 200;


let officeExtractor = null;
const office = async () => (officeExtractor ??= (await loadOffice())());

const QUALITY_MESSAGES = {
  empty: "No readable text was found in this file. If it is a scan, try a clearer image.",
  too_short: "This file has almost no text (fewer than 3 words). Upload the full material, or use a text prompt instead.",
  garbage: "The text in this file could not be read reliably (it looks like unreadable scan output). Try a clearer scan or a text/PDF version.",
};

const unreadable = (message) => new AppError("UNREADABLE_DOCUMENT", 422, message);

/**
 * OCR one or more images (PNG/JPEG/WebP buffers) with tesseract.js v6.
 * One worker per call, always terminated.
 */
export const runOCR = async (images) => {
  const createWorker = await loadTesseract();
  const worker = await createWorker(OCR_LANGUAGES, 1, {
    langPath: TESSDATA_DIR,
    gzip: false,
    cacheMethod: "none",
    // Without a handler tesseract.js re-throws worker errors from its message
    // listener, i.e. as an uncaught exception that would crash the process.
    errorHandler: (error) => console.error(`[ocr] worker error: ${error?.message || error}`),
  });
  try {
    const texts = [];
    for (const image of images) {
      try {
        const { data } = await worker.recognize(image);
        texts.push(data?.text || "");
      } catch (error) {
        // Tesseract aborts on degenerate images (e.g. 1x1 px); treat as "no text found".
        console.error(`[ocr] Tesseract could not read an image: ${error?.message || error}`);
        texts.push("");
      }
    }
    return texts.join("\n\n");
  } finally {
    await worker.terminate().catch(() => {});
  }
};

/** Render the first MAX_OCR_PAGES pages of a PDF to PNG buffers. */
const renderPdfPages = async (buffer) => {
  const { pdf } = await import("pdf-to-img");
  const document = await pdf(buffer, { scale: 2 });
  const pages = [];
  for await (const page of document) {
    pages.push(page);
    if (pages.length >= MAX_OCR_PAGES) break;
  }
  return pages;
};

export const cleanText = (text = "") =>
  String(text)
    .normalize("NFC")
    .replace(/\r\n/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\p{Cc}+/gu, (m) => (m.includes("\n") ? "\n" : " "))
    .trim();

/** OCR images: Gemini first in production (Tesseract as the fallback), Tesseract first otherwise. */
const ocrImages = async (images) => {
  if (ocrProvider() === "gemini") {
    try {
      const transcribed = cleanText(await ocrFallback.transcribe(images));
      if (assessTextQuality(transcribed).ok) return { text: transcribed, method: "ocr_gemini" };
    } catch (error) {
      console.error(`[ocr] Gemini OCR failed, using Tesseract: ${error.message}`);
    }
    return { text: cleanText(await runOCR(images)), method: "ocr_tesseract" };
  }
  const text = cleanText(await runOCR(images));
  if (assessTextQuality(text).ok || !ocrFallback.enabled()) return { text, method: "ocr_tesseract" };
  try {
    const transcribed = cleanText(await ocrFallback.transcribe(images));
    if (assessTextQuality(transcribed).ok) return { text: transcribed, method: "ocr_gemini" };
  } catch (error) {
    console.error(`[ocr] Gemini fallback failed: ${error.message}`);
  }
  return { text, method: "ocr_tesseract" };
};

/**
 * Extract text from an uploaded file and report how it was obtained
 * (text | office | pdf_text | ocr_tesseract | ocr_gemini). Throws AppError(422)
 * with a message a user can act on when the file has no usable text.
 */
export const extractTextWithMethod = async (buffer, mimeType) => {
  if (!buffer || buffer.length === 0) {
    throw unreadable("The uploaded file is empty.");
  }

  let result;

  if (mimeType.includes("officedocument") || mimeType.includes("msword") || mimeType.includes("presentation")) {
    result = { text: cleanText(await (await office()).extractText({ input: buffer, type: "buffer" })), method: "office" };
  } else if (mimeType === "application/pdf") {
    let parsedText;
    try {
      parsedText = cleanText((await (await loadPdfParse())(buffer)).text);
    } catch {
      parsedText = "";
    }
    // Little or no text layer: a scanned PDF. Render pages and OCR them.
    result =
      parsedText.length >= MIN_PDF_TEXT_CHARS ? { text: parsedText, method: "pdf_text" } : await ocrImages(await renderPdfPages(buffer));
  } else if (mimeType === "text/plain") {
    result = { text: cleanText(buffer.toString("utf-8")), method: "text" };
  } else if (mimeType.startsWith("image/")) {
    result = await ocrImages([buffer]);
  } else {
    throw new AppError("UNSUPPORTED_FILE_TYPE", 400, `Unsupported file type: ${mimeType}`);
  }

  const quality = assessTextQuality(result.text);
  if (!quality.ok) {
    throw unreadable(QUALITY_MESSAGES[quality.reason]);
  }
  return result;
};

export const extractTextFromFile = async (buffer, mimeType) => (await extractTextWithMethod(buffer, mimeType)).text;
