import path from "path";
import { fileURLToPath } from "url";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { createWorker } from "tesseract.js";
import { getTextExtractor } from "office-text-extractor";
import { AppError } from "../utils/AppError.js";
import { assessTextQuality } from "./textQuality.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Local Tesseract language data shipped in assets/tessdata (uncompressed). */
export const TESSDATA_DIR = path.join(__dirname, "..", "assets", "tessdata");
const OCR_LANGUAGES = ["eng", "ara", "urd"];
/** Scanned PDFs are OCR'd page by page; cap the work per upload. */
export const MAX_OCR_PAGES = 20;
/** A PDF whose text layer is shorter than this is treated as scanned. */
const MIN_PDF_TEXT_CHARS = 200;


const officeExtractor = getTextExtractor();

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
  const worker = await createWorker(OCR_LANGUAGES, 1, {
    langPath: TESSDATA_DIR,
    gzip: false,
    cacheMethod: "none",
  });
  try {
    const texts = [];
    for (const image of images) {
      const { data } = await worker.recognize(image);
      texts.push(data?.text || "");
    }
    return texts.join("\n\n");
  } finally {
    await worker.terminate();
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

/**
 * Extract text from an uploaded file. Throws AppError(422) with a message a
 * user can act on when the file has no usable text.
 */
export const extractTextFromFile = async (buffer, mimeType) => {
  if (!buffer || buffer.length === 0) {
    throw unreadable("The uploaded file is empty.");
  }

  let text;

  if (mimeType.includes("officedocument") || mimeType.includes("msword") || mimeType.includes("presentation")) {
    text = cleanText(await officeExtractor.extractText({ input: buffer, type: "buffer" }));
  } else if (mimeType === "application/pdf") {
    let parsedText;
    try {
      parsedText = cleanText((await pdfParse(buffer)).text);
    } catch {
      parsedText = "";
    }
    // Little or no text layer: a scanned PDF. Render pages and OCR them.
    text = parsedText.length >= MIN_PDF_TEXT_CHARS ? parsedText : cleanText(await runOCR(await renderPdfPages(buffer)));
  } else if (mimeType === "text/plain") {
    text = cleanText(buffer.toString("utf-8"));
  } else if (mimeType.startsWith("image/")) {
    text = cleanText(await runOCR([buffer]));
  } else {
    throw new AppError("UNSUPPORTED_FILE_TYPE", 400, `Unsupported file type: ${mimeType}`);
  }

  const quality = assessTextQuality(text);
  if (!quality.ok) {
    throw unreadable(QUALITY_MESSAGES[quality.reason]);
  }

  return text;
};
