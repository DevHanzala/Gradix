import pdf from "pdf-parse";
import { createWorker } from "tesseract.js";
import { getTextExtractor } from "office-text-extractor";

// Global OCR worker
let tesseractWorker = null;
const getTesseractWorker = async () => {
  if (!tesseractWorker) {
    tesseractWorker = await createWorker("eng", 1, { logger: () => {} });
  }
  return tesseractWorker;
};

// office-text-extractor handles: DOCX, PPTX, XLSX, etc.
const extractor = getTextExtractor();

export const extractTextFromFile = async (fileInput, mimeType, options = {}) => {
  const { socket, totalFiles = 1, currentFile = 1 } = options;

  try {
    const buffer = Buffer.isBuffer(fileInput) ? fileInput : Buffer.from(fileInput);
    let text = "";
    const basePercent = 35 + ((currentFile - 1) / totalFiles) * 25;

    if (socket) {
      socket.emit("assessment-progress", {
        percent: basePercent,
        message: `Reading ${mimeType.split("/")[1]?.toUpperCase() || "file"}...`,
      });
    }

    // Office files (DOCX, PPTX, XLSX, etc.) → office-text-extractor
    if (
      mimeType.includes("officedocument") ||
      mimeType.includes("msword") ||
      mimeType.includes("powerpoint") ||
      mimeType.includes("presentation") ||
      mimeType.includes("spreadsheet")
    ) {
      const result = await extractor.extractText({ input: buffer, type: "buffer" });
      text = cleanText(result);
    }
    // PDF → pdf-parse (better than office-text-extractor for PDFs)
    else if (mimeType === "application/pdf") {
      const data = await pdf(buffer);
      text = cleanText(data.text);
    }
    // TXT
    else if (mimeType === "text/plain") {
      text = cleanText(buffer.toString("utf-8"));
    }
    // Images → OCR
    else if (mimeType.startsWith("image/")) {
      if (socket) {
        socket.emit("assessment-progress", { percent: basePercent + 10, message: "Running OCR..." });
      }
      const worker = await getTesseractWorker();
      const { data } = await worker.recognize(buffer);
      text = cleanText(data.text);
    }
    else {
      throw new Error(`Unsupported file type: ${mimeType}`);
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
    if (socket) {
      socket.emit("assessment-progress", { percent: 0, message: `Failed: ${error.message}` });
    }
    throw error;
  }
};

export const cleanText = (text) => {
  if (!text) return "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\t/g, " ")
    .replace(/[^\x20-\x7E\n]/g, " ")
    .trim()
    .toLowerCase();
};

export const chunkText = (text, maxWords = 500) => {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const chunks = [];
  let current = [];
  let count = 0;

  for (const word of words) {
    current.push(word);
    count++;
    if (count >= maxWords) {
      chunks.push(current.join(" "));
      current = [];
      count = 0;
    }
  }
  if (current.length > 0) chunks.push(current.join(" "));
  return chunks;
};