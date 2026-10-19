import { countTokens, EMBEDDING_MAX_TOKENS } from "./embeddingGenerator.js";

/**
 * Retrieval chunking (Phase 2).
 *
 * - Target ~220 tokens (hard max 260) as counted by the embedding model's own
 *   tokenizer, well inside its 512-token window.
 * - ~15% overlap: each chunk starts with the last whole sentence(s) of the
 *   previous chunk, so facts that straddle a boundary stay retrievable.
 * - Never splits inside a sentence unless that sentence alone is too long;
 *   prefers to end a chunk at a paragraph break once it is big enough.
 * - Sentence endings for Latin (. ! ?), Urdu (۔), Arabic/Persian (؟ ؛).
 */
export const CHUNKING_VERSION = 2;
export const CHUNK_CONFIG = {
  targetTokens: 220,
  maxTokens: 260,
  minParagraphBreakTokens: 140, // end at a paragraph break once we have this much
  overlapRatio: 0.15,
  minLastChunkTokens: 60, // a smaller tail is merged into the previous chunk
};

const SENTENCE_END = /(?<=[.!?۔؟؛])\s+|(?<=[.!?۔؟؛]["'”’)\]»])\s+/u;
const CLAUSE_BREAK = /(?<=[,;:،؛])\s+/u;

/** Split text into paragraphs, then sentences. Returns [{ text, paragraphEnd }]. */
export const splitSentences = (text) => {
  const units = [];
  const paragraphs = String(text)
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/u)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
  for (const paragraph of paragraphs) {
    const sentences = paragraph.split(SENTENCE_END).map((s) => s.trim()).filter(Boolean);
    sentences.forEach((sentence, i) => units.push({ text: sentence, paragraphEnd: i === sentences.length - 1 }));
  }
  return units;
};

/** Break one over-long sentence at clause marks, then at word boundaries. */
const splitLongSentence = async (sentence, maxTokens) => {
  const pieces = [];
  const clauses = sentence.text.split(CLAUSE_BREAK).filter(Boolean);
  let buffer = "";
  const flushWords = async (text) => {
    const words = text.split(/\s+/u);
    let current = [];
    for (const word of words) {
      const candidate = [...current, word].join(" ");
      if (current.length && (await countTokens(candidate)) > maxTokens) {
        pieces.push(current.join(" "));
        current = [word];
      } else {
        current.push(word);
      }
    }
    if (current.length) pieces.push(current.join(" "));
  };

  for (const clause of clauses) {
    const candidate = buffer ? `${buffer} ${clause}` : clause;
    if ((await countTokens(candidate)) <= maxTokens) {
      buffer = candidate;
      continue;
    }
    if (buffer) pieces.push(buffer);
    if ((await countTokens(clause)) > maxTokens) {
      await flushWords(clause);
      buffer = "";
    } else {
      buffer = clause;
    }
  }
  if (buffer) pieces.push(buffer);
  return pieces.map((text, i) => ({ text, paragraphEnd: sentence.paragraphEnd && i === pieces.length - 1 }));
};

/**
 * Chunk a document. Returns [{ index, text, tokenCount }].
 */
export const chunkDocument = async (text, config = CHUNK_CONFIG) => {
  const { targetTokens, maxTokens, minParagraphBreakTokens, overlapRatio, minLastChunkTokens } = config;

  // 1. Sentence units, with over-long sentences split, each with a token count.
  const units = [];
  for (const sentence of splitSentences(text)) {
    const tokens = await countTokens(sentence.text);
    if (tokens > maxTokens) {
      for (const piece of await splitLongSentence(sentence, maxTokens)) {
        units.push({ ...piece, tokens: await countTokens(piece.text) });
      }
    } else {
      units.push({ ...sentence, tokens });
    }
  }
  if (units.length === 0) return [];

  // 2. Greedy packing with sentence-level overlap.
  const chunks = [];
  let start = 0;
  while (start < units.length) {
    let end = start;
    let tokens = 0;
    while (end < units.length && tokens + units[end].tokens <= maxTokens) {
      tokens += units[end].tokens;
      end += 1;
      if (tokens >= targetTokens) break;
      if (tokens >= minParagraphBreakTokens && units[end - 1].paragraphEnd) break;
    }
    if (end === start) {
      // A single unit that is somehow still too large: take it alone.
      tokens = units[start].tokens;
      end = start + 1;
    }
    chunks.push({ unitStart: start, unitEnd: end, tokens });
    if (end >= units.length) break;

    // Overlap: step back over trailing sentences worth up to overlapRatio of this chunk.
    const overlapBudget = Math.floor(tokens * overlapRatio);
    let back = end;
    let overlapTokens = 0;
    while (back - 1 > start && overlapTokens + units[back - 1].tokens <= overlapBudget) {
      back -= 1;
      overlapTokens += units[back].tokens;
    }
    start = back < end ? back : end;
  }

  // 3. Merge a very small tail into the previous chunk when it still fits the model.
  if (chunks.length > 1) {
    const last = chunks[chunks.length - 1];
    const prev = chunks[chunks.length - 2];
    if (last.tokens < minLastChunkTokens) {
      const merged = units.slice(prev.unitStart, last.unitEnd).reduce((s, u) => s + u.tokens, 0);
      if (merged <= EMBEDDING_MAX_TOKENS - 16) {
        prev.unitEnd = last.unitEnd;
        prev.tokens = merged;
        chunks.pop();
      }
    }
  }

  const result = [];
  for (const [index, chunk] of chunks.entries()) {
    const chunkText = units
      .slice(chunk.unitStart, chunk.unitEnd)
      .map((u) => u.text)
      .join(" ");
    result.push({ index, text: chunkText, tokenCount: await countTokens(chunkText) });
  }
  return result;
};
