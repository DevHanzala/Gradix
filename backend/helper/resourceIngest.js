import { extractTextFromFile, chunkText } from "./textProcessor.js";
import { generateEmbedding } from "./embeddingGenerator.js";
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
  try {
    text = await extractTextFromFile(file.buffer, file.mimetype);
  } catch (error) {
    if (error instanceof AppError) {
      throw new AppError(error.code, error.status, `${name}: ${error.message}`);
    }
    throw new AppError("UNREADABLE_DOCUMENT", 422, `${name}: the file could not be read.`);
  }

  const chunks = chunkText(text);
  const embeddings = [];
  for (const chunk of chunks) {
    embeddings.push(await generateEmbedding(chunk));
  }

  return { name, mimetype: file.mimetype, size: file.size, chunks, embeddings };
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
    },
    client
  );

  for (let i = 0; i < prepared.chunks.length; i++) {
    await createResourceChunkQuery(
      { resourceId: resource.id, chunkText: prepared.chunks[i], embedding: prepared.embeddings[i], chunkIndex: i },
      client
    );
  }

  return resource;
};
