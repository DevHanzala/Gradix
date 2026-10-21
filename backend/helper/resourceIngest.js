import { createHash } from "crypto";
import { extractTextWithMethod } from "./textProcessor.js";
import { embedPassages, EMBEDDING_MODEL } from "./embeddingGenerator.js";
import { chunkDocument, CHUNKING_VERSION } from "./chunker.js";
import { detectLanguage } from "./language.js";
import { createResourceQuery } from "../repositories/resourceRepository.js";
import { createResourceChunkQuery } from "../repositories/assessmentRepository.js";
import { AppError } from "../utils/AppError.js";

/**
 * Two-phase ingestion so uploads are atomic:
 *   1. prepare*: extract text, chunk and embed — slow, may fail, writes nothing.
 *   2. insertPreparedResource: write resource + chunks with a transaction client.
 * If anything fails in phase 1 the database is untouched; phase 2 runs inside
 * the caller's transaction, so it is all-or-nothing.
 */

/** Multer decodes UTF-8 filenames as latin1; recover the real (e.g. Urdu) name. */
export const decodeFilename = (name) => {
  try {
    const decoded = Buffer.from(String(name), "latin1").toString("utf8");
    return decoded.includes("�") ? String(name) : decoded;
  } catch {
    return String(name);
  }
};

export const prepareUploadedFile = async (file) => {
  const name = decodeFilename(file.originalname);
  let text;
  let method;
  try {
    ({ text, method } = await extractTextWithMethod(file.buffer, file.mimetype));
  } catch (error) {
    if (error instanceof AppError) {
      throw new AppError(error.code, error.status, `${name}: ${error.message}`);
    }
    throw new AppError("UNREADABLE_DOCUMENT", 422, `${name}: the file could not be read.`);
  }

  // Which extraction path was used is logged and stored (resources.extraction_method).
  console.info(`[ingest] ${name}: text extracted via ${method}`);
  return { name, mimetype: file.mimetype, size: file.size, extractionMethod: method, ...(await prepareText(text)) };
};

/** sha256 of the normalised text; identical material hashes the same. */
export const contentHash = (text) =>
  createHash("sha256").update(String(text).normalize("NFC").replace(/\s+/gu, " ").trim()).digest("hex");

/** Chunk + embed extracted text. Pure (writes nothing). */
export const prepareText = async (text) => {
  const chunks = await chunkDocument(text);
  const embeddings = await embedPassages(chunks.map((c) => c.text));
  return {
    text,
    hash: contentHash(text),
    language: detectLanguage(text),
    chunks,
    embeddings,
  };
};

/** Replace a resource's chunks (used by upload and by the re-chunk job). */
export const insertChunks = async (client, resourceId, prepared) => {
  for (const [i, chunk] of prepared.chunks.entries()) {
    await createResourceChunkQuery(
      {
        resourceId,
        chunkText: chunk.text,
        embedding: prepared.embeddings[i],
        chunkIndex: chunk.index,
        tokenCount: chunk.tokenCount,
        embeddingModel: EMBEDDING_MODEL,
      },
      client
    );
  }
};

/** Prepare every file or fail on the first unusable one (nothing is written). */
export const prepareUploadedFiles = async (files = []) => {
  const prepared = [];
  for (const file of files) {
    prepared.push(await prepareUploadedFile(file));
  }
  return prepared;
};

export const insertPreparedResource = async (client, prepared, { userId, visibility = "private", name } = {}) => {
  const resource = await createResourceQuery(
    {
      name: (name && String(name).trim()) || prepared.name,
      file_type: prepared.mimetype,
      file_size: prepared.size,
      content_type: "file",
      visibility,
      uploaded_by: userId,
      content_text: prepared.text,
      content_hash: prepared.hash,
      language: prepared.language,
      chunking_version: CHUNKING_VERSION,
      embedding_model: EMBEDDING_MODEL,
      extraction_method: prepared.extractionMethod || null,
    },
    client
  );

  await insertChunks(client, resource.id, prepared);

  return resource;
};
