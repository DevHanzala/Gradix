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
 */
export const generateEmbedding = async (text, options = {}) => {
  const {
    socket,
    totalChunks = 1,
    currentChunk = 1,
    fileIndex = 1,
    totalFiles = 1,
  } = options;

  // 🔴 HARD GUARD — prevents bad embeddings
  if (!text || text.length < 120) {
    throw new Error("Text chunk too small or noisy for embedding");
  }

  try {
    const model = await loadModel();

    const fileBase = 70 + ((fileIndex - 1) / totalFiles) * 20;
    const chunkBase = fileBase + ((currentChunk - 1) / totalChunks) * 20;

    if (socket) {
      socket.emit("assessment-progress", {
        percent: chunkBase,
        message: `AI processing chunk ${currentChunk}/${totalChunks} (File ${fileIndex}/${totalFiles})`,
      });
    }

    const output = await model(text, {
      pooling: "mean",
      normalize: true,
    });

    if (socket) {
      socket.emit("assessment-progress", {
        percent: chunkBase + (20 / totalChunks),
        message: `Chunk ${currentChunk}/${totalChunks} embedded`,
      });
    }

    return Array.from(output.data);
  } catch (error) {
    console.error("Error generating embedding:", error);
    if (socket) {
      socket.emit("assessment-progress", {
        percent: 0,
        message: `Embedding failed: ${error.message}`,
      });
    }
    throw error;
  }
};
