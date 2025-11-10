import pdf from "pdf-parse";
import mammoth from "mammoth";

/**
 * Extract text from file Buffer or path (for backward compatibility)
 * @param {Buffer|string} fileInput - Buffer (in-memory) or file path (legacy)
 * @param {string} mimeType
 * @param {Object} [options] - Optional config
 * @param {Object} [options.socket] - WebSocket to emit progress
 * @param {number} [options.totalFiles] - Total files being processed
 * @param {number} [options.currentFile] - Current file index (1-based)
 * @returns {Promise<string>}
 */
export const extractTextFromFile = async (fileInput, mimeType, options = {}) => {
  const { socket, totalFiles = 1, currentFile = 1 } = options;

  try {
    // Helper: Get buffer from input
    const getBuffer = async () => {
      if (Buffer.isBuffer(fileInput)) {
        return fileInput;
      }
      const fs = await import("fs/promises");
      return await fs.readFile(fileInput);
    };

    const buffer = await getBuffer();

    let text = '';
    const basePercent = 35 + ((currentFile - 1) / totalFiles) * 25; // Start of this file's range
    const extractionStart = basePercent;

    if (mimeType === "application/pdf") {
      // Progress: Start PDF parsing
      if (socket) {
        socket.emit('assessment-progress', { percent: extractionStart, message: `Reading PDF... (${currentFile}/${totalFiles})` });
      }

      const data = await pdf(buffer);
      text = cleanText(data.text);

      // Progress: PDF done
      if (socket) {
        socket.emit('assessment-progress', { percent: extractionStart + 20, message: `PDF extracted (${text.length} chars)` });
      }
    } 
    else if (
      mimeType === "application/msword" ||
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      if (socket) {
        socket.emit('assessment-progress', { percent: extractionStart, message: `Reading DOCX... (${currentFile}/${totalFiles})` });
      }

      const result = await mammoth.extractRawText({ buffer });
      text = cleanText(result.value);

      if (socket) {
        socket.emit('assessment-progress', { percent: extractionStart + 20, message: `DOCX extracted (${text.length} chars)` });
      }
    } 
    else if (mimeType === "text/plain") {
      if (socket) {
        socket.emit('assessment-progress', { percent: extractionStart, message: `Reading TXT... (${currentFile}/${totalFiles})` });
      }

      text = cleanText(buffer.toString("utf-8"));

      if (socket) {
        socket.emit('assessment-progress', { percent: extractionStart + 20, message: `TXT loaded (${text.length} chars)` });
      }
    } 
    else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }

    // Final progress for this file
    if (socket) {
      socket.emit('assessment-progress', { percent: extractionStart + 25, message: `Text ready for chunking` });
    }

    return text;
  } catch (error) {
    console.error("Error extracting text from file:", error);
    if (socket) {
      socket.emit('assessment-progress', { percent: 0, message: `Failed to read file: ${error.message}` });
    }
    throw error;
  }
};

export const cleanText = (text) => {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[^\x20-\x7E\n]/g, "")
    .trim()
    .toLowerCase();
};

export const chunkText = (text, maxWords = 500) => {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const chunks = [];
  let currentChunk = [];
  let wordCount = 0;

  for (const word of words) {
    currentChunk.push(word);
    wordCount++;
    if (wordCount >= maxWords) {
      chunks.push(currentChunk.join(" "));
      currentChunk = [];
      wordCount = 0;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(" "));
  }

  console.log(`Created ${chunks.length} chunks from text`);
  return chunks;
};