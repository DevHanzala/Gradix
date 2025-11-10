import { pipeline } from "@xenova/transformers";

let model = null;

const loadModel = async () => {
  if (!model) {
    model = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    console.log("Loaded Xenova sentence-transformers model: all-MiniLM-L6-v2");
  }
  return model;
};

/**
 * Generate embedding for a text chunk
 * @param {string} text - The chunk of text
 * @param {Object} [options] - Optional config
 * @param {Object} [options.socket] - WebSocket to emit progress
 * @param {number} [options.totalChunks] - Total chunks in this file
 * @param {number} [options.currentChunk] - Current chunk index (1-based)
 * @param {number} [options.fileIndex] - Current file index
 * @param {number} [options.totalFiles] - Total files being processed
 * @returns {Promise<number[]>}
 */
export const generateEmbedding = async (text, options = {}) => {
  const {
    socket,
    totalChunks = 1,
    currentChunk = 1,
    fileIndex = 1,
    totalFiles = 1,
  } = options;

  try {
    const model = await loadModel();

    // Calculate progress range for this chunk
    const fileBase = 70 + ((fileIndex - 1) / totalFiles) * 20; // 70–90%
    const chunkBase = fileBase + ((currentChunk - 1) / totalChunks) * 20;
    const startPercent = chunkBase;
    const endPercent = chunkBase + (20 / totalChunks);

    // Emit start
    if (socket) {
      socket.emit('assessment-progress', {
        percent: startPercent,
        message: `AI processing chunk ${currentChunk}/${totalChunks} (File ${fileIndex}/${totalFiles})`
      });
    }

    const output = await model(text, { pooling: "mean", normalize: true });

    // Emit completion
    if (socket) {
      socket.emit('assessment-progress', {
        percent: endPercent,
        message: `Chunk ${currentChunk}/${totalChunks} embedded`
      });
    }

    console.log(`Generated embedding for chunk ${currentChunk}/${totalChunks} (file ${fileIndex})`);
    return Array.from(output.data);
  } catch (error) {
    console.error("Error generating embedding:", error);
    if (socket) {
      socket.emit('assessment-progress', {
        percent: 0,
        message: `Embedding failed: ${error.message}`
      });
    }
    throw error;
  }
};