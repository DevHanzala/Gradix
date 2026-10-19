/**
 * Multilingual sentence embeddings for retrieval (English, Urdu, Arabic,
 * Persian and ~100 other languages).
 *
 * Model: multilingual-e5-small (384 dimensions, 512-token window). e5 models
 * expect "passage: " before stored text and "query: " before search text.
 * The model runs locally in Node (no API cost); it is downloaded once on
 * first use and cached.
 */
export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "Xenova/multilingual-e5-small";
export const EMBEDDING_DIMENSIONS = 384;
export const EMBEDDING_MAX_TOKENS = 512;
const BATCH_SIZE = 16;

let pipelinePromise = null;
const loadPipeline = () => {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      if (process.env.EMBEDDING_CACHE_DIR) env.cacheDir = process.env.EMBEDDING_CACHE_DIR;
      return pipeline("feature-extraction", EMBEDDING_MODEL, { dtype: "q8" });
    })().catch((error) => {
      pipelinePromise = null; // allow a retry after a failed download
      throw error;
    });
  }
  return pipelinePromise;
};

const embedWithModel = async (texts) => {
  const extractor = await loadPipeline();
  const vectors = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const output = await extractor(texts.slice(i, i + BATCH_SIZE), { pooling: "mean", normalize: true });
    vectors.push(...output.tolist());
  }
  return vectors;
};

const countWithTokenizer = async (text) => {
  const extractor = await loadPipeline();
  return extractor.tokenizer.encode(String(text)).length;
};

/**
 * Indirection so tests can avoid downloading the model.
 * embed(texts[]) -> number[][]; countTokens(text) -> number
 */
export const embeddingAdapter = {
  embed: embedWithModel,
  countTokens: countWithTokenizer,
};

const assertVector = (vector) => {
  if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding has ${vector?.length} dimensions, expected ${EMBEDDING_DIMENSIONS}`);
  }
  return vector;
};

/** Embeddings for stored text (resource chunks). */
export const embedPassages = async (texts) => {
  if (!texts.length) return [];
  if (texts.some((t) => !String(t || "").trim())) throw new Error("Cannot embed empty text");
  const vectors = await embeddingAdapter.embed(texts.map((t) => `passage: ${t}`));
  return vectors.map(assertVector);
};

/** Embedding for a search query (objective text, assessment topic). */
export const embedQuery = async (text) => {
  if (!String(text || "").trim()) throw new Error("Cannot embed empty text");
  const [vector] = await embeddingAdapter.embed([`query: ${text}`]);
  return assertVector(vector);
};

/** Token count as the embedding model sees it. */
export const countTokens = (text) => embeddingAdapter.countTokens(String(text || ""));

/** pgvector literal for a vector: "[0.1,0.2,...]". */
export const toPgVector = (vector) => `[${assertVector(vector).join(",")}]`;
