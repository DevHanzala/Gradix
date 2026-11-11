/**
 * Multilingual sentence embeddings for retrieval (English, Urdu, Arabic,
 * Persian and ~100 other languages), from one of two providers (EMBEDDING_PROVIDER):
 *
 *  - local (development default): multilingual-e5-small in Node (384 dimensions,
 *    512-token window, ~120 MB in memory). e5 expects "passage: " / "query: " prefixes.
 *  - gemini (production): Google's gemini-embedding-001 API, truncated to 384
 *    dimensions, so the database column and index stay the same and nothing heavy
 *    is loaded on a 512 MB server. Tokens are estimated instead of counted.
 *
 * Vectors from different models must not be mixed: each resource records its
 * embedding_model, and the re-chunk sweep re-embeds resources (and pool questions)
 * made with another model.
 */
export const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER === "gemini" ? "gemini" : "local";
const GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_MODEL =
  EMBEDDING_PROVIDER === "gemini" ? `${GEMINI_EMBEDDING_MODEL}@384` : process.env.EMBEDDING_MODEL || "Xenova/multilingual-e5-small";
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

// ------------------------------------------------------------ gemini

const normalize = (v) => {
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
};

let geminiKeyIndex = 0;
/** Gemini embeddings; "passage: " / "query: " prefixes choose the task type. Rotates keys on 429. */
const embedWithGemini = async (texts) => {
  const [{ GoogleGenAI }, { listCreationKeys }] = await Promise.all([import("@google/genai"), import("../services/ai/aiProviders.js")]);
  const keys = listCreationKeys().filter((k) => k.type === "gemini");
  if (!keys.length) throw new Error("No Gemini key for embeddings");
  const query = texts.every((t) => t.startsWith("query: "));
  const contents = texts.map((t) => t.replace(/^(passage|query): /, ""));
  const vectors = [];
  for (let i = 0; i < contents.length; i += 100) {
    const batch = contents.slice(i, i + 100);
    let result;
    for (let tried = 0; tried < keys.length; tried++) {
      const key = keys[(geminiKeyIndex + tried) % keys.length];
      try {
        result = await new GoogleGenAI({ apiKey: key.secret }).models.embedContent({
          model: GEMINI_EMBEDDING_MODEL,
          contents: batch,
          config: { taskType: query ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT", outputDimensionality: EMBEDDING_DIMENSIONS },
        });
        geminiKeyIndex = (geminiKeyIndex + tried) % keys.length;
        break;
      } catch (error) {
        if (error.status !== 429 || tried === keys.length - 1) throw error;
      }
    }
    // Truncated (384-dimension) Gemini vectors must be re-normalised for cosine search.
    vectors.push(...result.embeddings.map((e) => normalize(e.values)));
  }
  return vectors;
};

/** Token estimate without a tokenizer (about 1.9 tokens per word across en/ur/ar/fa). */
export const estimateTokenCount = (text) => Math.ceil(String(text).split(/\s+/u).filter(Boolean).length * 1.9) + 2;

/**
 * Indirection so tests can avoid downloading the model.
 * embed(texts[]) -> number[][]; countTokens(text) -> number
 */
export const embeddingAdapter = {
  embed: EMBEDDING_PROVIDER === "gemini" ? embedWithGemini : embedWithModel,
  countTokens: EMBEDDING_PROVIDER === "gemini" ? async (text) => estimateTokenCount(text) : countWithTokenizer,
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
