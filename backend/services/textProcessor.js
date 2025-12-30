import pdf from "pdf-parse";
import { createWorker } from "tesseract.js";
import { getTextExtractor } from "office-text-extractor";

// ---------- OCR WORKER (MULTI-LANG) ----------
let tesseractWorker = null;
const getTesseractWorker = async (langs = "eng") => {
  if (!tesseractWorker) {
    tesseractWorker = await createWorker(langs, 1, { logger: () => {} });
  }
  return tesseractWorker;
};

// Office extractor (DOCX, PPTX, XLSX only)
const extractor = getTextExtractor();

// ---------- MAIN EXTRACTOR ----------
export const extractTextFromFile = async (fileInput, mimeType, options = {}) => {
  const { socket, totalFiles = 1, currentFile = 1 } = options;

  const buffer = Buffer.isBuffer(fileInput)
    ? fileInput
    : Buffer.from(fileInput);

  let text = "";
  const basePercent = 35 + ((currentFile - 1) / totalFiles) * 25;

  try {
    if (socket) {
      socket.emit("assessment-progress", {
        percent: basePercent,
        message: `Reading ${mimeType}...`,
      });
    }

    // ---------- OFFICE FILES ----------
    if (
      mimeType.includes("officedocument") ||
      mimeType.includes("msword") ||
      mimeType.includes("powerpoint") ||
      mimeType.includes("spreadsheet")
    ) {
      try {
        const result = await extractor.extractText({
          input: buffer,
          type: "buffer",
        });
        text = cleanText(result);
      } catch {
        // Legacy Office fallback → OCR
        const worker = await getTesseractWorker("eng+urd+ara+hin");
        const { data } = await worker.recognize(buffer);
        text = cleanText(data.text);
      }
    }

    // ---------- PDF (NO PAGE LIMIT) ----------
    else if (mimeType === "application/pdf") {
      const data = await pdf(buffer, { max: 0 });

      if (!data.text || data.text.length < 1000) {
        // OCR fallback for scanned PDFs
        const worker = await getTesseractWorker("eng+urd+ara+hin");
        const { data: ocrData } = await worker.recognize(buffer);
        text = cleanText(ocrData.text);
      } else {
        text = cleanText(data.text);
      }

      // Guard against silent truncation
      if (data.numpages > 50 && text.length < data.numpages * 400) {
        throw new Error("PDF extraction incomplete");
      }
    }

    // ---------- TEXT ----------
    else if (mimeType === "text/plain") {
      text = cleanText(buffer.toString("utf-8"));
    }

    // ---------- IMAGES ----------
    else if (mimeType.startsWith("image/")) {
      const worker = await getTesseractWorker("eng+urd+ara+hin");
      const { data } = await worker.recognize(buffer);
      text = cleanText(data.text);
    }

    else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }

    // ---------- SCRIPT DETECTION ----------
    const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
    const latinChars = (text.match(/[a-zA-Z]/g) || []).length;

    if (arabicChars > latinChars * 1.5) {
      const worker = await getTesseractWorker("urd+ara");
      const { data } = await worker.recognize(buffer);
      text = cleanText(data.text);
    }

    // ---------- WORD REPAIR ----------
    text = text
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\s{2,}/g, " ");

    // ---------- QUALITY GUARDS ----------
    const words = text.split(/\s+/);
    const uniqueRatio = new Set(words).size / words.length;
    const isRTL = arabicChars > latinChars;

    if (
      words.length < (isRTL ? 40 : 80) ||
      uniqueRatio < 0.25
    ) {
      throw new Error("Low semantic quality detected");
    }

    if (socket) {
      socket.emit("assessment-progress", {
        percent: basePercent + 25,
        message: `Text extracted (${text.length} chars)`,
      });
    }

    return text;

  } catch (error) {
    console.error("Text extraction failed:", error.message);
    throw error;
  }
};

// ---------- CLEAN TEXT ----------
export const cleanText = (text) => {
  if (!text) return "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\t/g, " ")
    .replace(/\p{C}+/gu, " ")
    .trim();
};

// ---------- CHUNK ----------
export const chunkText = (text, maxWords = 500) => {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(" "));
  }
  return chunks;
};
