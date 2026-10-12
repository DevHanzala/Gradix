import path from "path";
import { fileURLToPath } from "url";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { createWorker } from "tesseract.js";
import { getTextExtractor } from "office-text-extractor";
import { AppError } from "../utils/AppError.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Local Tesseract language data shipped in assets/tessdata (uncompressed). */
export const TESSDATA_DIR = path.join(__dirname, "..", "assets", "tessdata");
const OCR_LANGUAGES = ["eng", "ara", "urd"];
/** Scanned PDFs are OCR'd page by page; cap the work per upload. */
export const MAX_OCR_PAGES = 20;
/** A PDF whose text layer is shorter than this is treated as scanned. */
const MIN_PDF_TEXT_CHARS = 200;

export const MIN_DOCUMENT_WORDS = 20;
export const CHUNK_WORDS = 500;
/** A trailing chunk smaller than this is merged into the previous chunk. */
export const MIN_CHUNK_WORDS = 50;

const officeExtractor = getTextExtractor();

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

  let text = "";

  if (mimeType.includes("officedocument") || mimeType.includes("msword") || mimeType.includes("presentation")) {
    text = cleanText(await officeExtractor.extractText({ input: buffer, type: "buffer" }));
  } else if (mimeType === "application/pdf") {
    let parsedText = "";
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

  const words = text.split(/\s+/u).filter(Boolean);
  if (words.length === 0) {
    throw unreadable("No readable text was found in this file. If it is a scan, try a clearer image.");
  }
  if (words.length < MIN_DOCUMENT_WORDS) {
    throw unreadable(
      `This file contains only ${words.length} words. Please upload a document with at least ${MIN_DOCUMENT_WORDS} words, or use a text prompt instead.`
    );
  }

  return text;
};

/**
 * Split text into ~CHUNK_WORDS-word chunks. A short trailing piece is merged
 * into the previous chunk so no chunk is too small to embed meaningfully.
 */
export const chunkText = (text, size = CHUNK_WORDS) => {
  const words = String(text).split(/\s+/u).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size));
  }
  if (chunks.length > 1 && chunks[chunks.length - 1].length < MIN_CHUNK_WORDS) {
    const last = chunks.pop();
    chunks[chunks.length - 1] = chunks[chunks.length - 1].concat(last);
  }
  return chunks.map((c) => c.join(" "));
};
