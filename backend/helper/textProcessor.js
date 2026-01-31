import pdf from "pdf-parse";
import { createWorker } from "tesseract.js";
import { getTextExtractor } from "office-text-extractor";

const extractor = getTextExtractor();

/**
 * OCR RUNNER
 * - In-memory only
 * - One worker per call
 * - Always terminated
 */
const runOCR = async (buffer, langs = ["eng"]) => {
  if (!Array.isArray(langs)) {
    throw new Error("OCR languages must be an array");
  }

  const worker = await createWorker(); // ✅ NO CONFIG OBJECT

  try {
    await worker.loadLanguage(langs);
    await worker.initialize(langs);

    const { data } = await worker.recognize(buffer);
    return data?.text || "";
  } finally {
    await worker.terminate();
  }
};

/**
 * TEXT EXTRACTION ENTRY POINT
 */
export const extractTextFromFile = async (buffer, mimeType) => {
  if (!buffer || buffer.length === 0) {
    throw new Error("Uploaded file buffer is empty");
  }

  let text = "";

  // -------- OFFICE FILES --------
  if (
    mimeType.includes("officedocument") ||
    mimeType.includes("msword") ||
    mimeType.includes("presentation")
  ) {
    const result = await extractor.extractText({
      input: buffer,
      type: "buffer",
    });
    text = cleanText(result);
  }

  // -------- PDF --------
  else if (mimeType === "application/pdf") {
    let parsed = null;

    try {
      parsed = await pdf(buffer);
    } catch {
      parsed = null;
    }

    if (!parsed || !parsed.text || parsed.text.trim().length < 300) {
      // OCR fallback
      text = cleanText(
        await runOCR(buffer, ["eng", "urd", "ara", "hin"])
      );
    } else {
      text = cleanText(parsed.text);
    }
  }

  // -------- TEXT --------
  else if (mimeType === "text/plain") {
    text = cleanText(buffer.toString("utf-8"));
  }

  // -------- IMAGE --------
  else if (mimeType.startsWith("image/")) {
    text = cleanText(
      await runOCR(buffer, ["eng", "urd", "ara", "hin"])
    );
  }

  // -------- UNSUPPORTED --------
  else {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  // -------- QUALITY FILTER --------
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    throw new Error("No readable text extracted");
  }

  const uniqueRatio = new Set(words).size / words.length;

  if (words.length < 80 || uniqueRatio < 0.3) {
    throw new Error("Low semantic quality detected");
  }

  return text;
};

/**
 * TEXT NORMALIZATION
 */
export const cleanText = (text = "") =>
  text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\p{C}+/gu, " ")
    .trim();

/**
 * CHUNKING FOR EMBEDDINGS
 */
export const chunkText = (text, size = 500) => {
  const words = text.split(/\s+/);
  const chunks = [];

  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size).join(" "));
  }

  return chunks;
};
