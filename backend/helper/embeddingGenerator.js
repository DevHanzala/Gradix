import { pipeline } from "@xenova/transformers";

export const EMBEDDING_DIMENSIONS = 384;

let modelPromise = null;
const loadModel = () => {
  if (!modelPromise) {
    modelPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2").catch((error) => {
      modelPromise = null; // allow a retry after a failed download
      throw error;
    });
  }
  return modelPromise;
};

const embedWithModel = async (text) => {
  const model = await loadModel();
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
};

/** Indirection so tests can avoid downloading the model. */
export const embeddingAdapter = { embed: embedWithModel };

/** 384-dimensional sentence embedding for a text chunk. */
export const generateEmbedding = async (text) => {
  if (!text || !String(text).trim()) {
    throw new Error("Cannot embed empty text");
  }
  const vector = await embeddingAdapter.embed(String(text));
  if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding has ${vector?.length} dimensions, expected ${EMBEDDING_DIMENSIONS}`);
  }
  return vector;
};
