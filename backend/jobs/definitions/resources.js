import db, { withTransaction } from "../../DB/db.js";
import { defineJob } from "../registry.js";
import { enqueue } from "../queue.js";
import { prepareText, insertChunks } from "../../helper/resourceIngest.js";
import { CHUNKING_VERSION } from "../../helper/chunker.js";
import { EMBEDDING_MODEL } from "../../helper/embeddingGenerator.js";

/**
 * Bring a resource up to the current chunking + embedding version.
 * Text comes from resources.content_text, or (Phase 1 resources, which did
 * not keep it) from the old chunks joined in order. Idempotent: a resource
 * already on the current version is skipped.
 */
export const rechunkResourceJob = async ({ resourceId }) => {
  const { rows } = await db.query(
    `SELECT id, content_text, chunking_version, embedding_model FROM resources WHERE id = $1`,
    [resourceId]
  );
  const resource = rows[0];
  if (!resource) return { skipped: "missing" };
  if (resource.chunking_version >= CHUNKING_VERSION && resource.embedding_model === EMBEDDING_MODEL) {
    return { skipped: "current" };
  }

  let text = resource.content_text;
  if (!text) {
    const old = await db.query(`SELECT chunk_text FROM resource_chunks WHERE resource_id = $1 ORDER BY chunk_index`, [
      resourceId,
    ]);
    text = old.rows.map((r) => r.chunk_text).join("\n\n");
  }
  if (!text.trim()) {
    // Link resources without text: nothing to embed, just mark them current.
    await db.query(`UPDATE resources SET chunking_version = $2, embedding_model = $3 WHERE id = $1`, [
      resourceId,
      CHUNKING_VERSION,
      EMBEDDING_MODEL,
    ]);
    return { chunks: 0 };
  }

  const prepared = await prepareText(text);
  await withTransaction(async (client) => {
    await client.query(`DELETE FROM resource_chunks WHERE resource_id = $1`, [resourceId]);
    await insertChunks(client, resourceId, prepared);
    await client.query(
      `UPDATE resources
       SET content_text = $2, content_hash = $3, language = $4, chunking_version = $5, embedding_model = $6
       WHERE id = $1`,
      [resourceId, prepared.text, prepared.hash, prepared.language, CHUNKING_VERSION, EMBEDDING_MODEL]
    );
  });
  return { chunks: prepared.chunks.length };
};

/** Enqueue a rechunk for every resource that is behind. */
export const rechunkSweepJob = async () => {
  const { rows } = await db.query(
    `SELECT id FROM resources WHERE chunking_version < $1 OR embedding_model IS DISTINCT FROM $2 ORDER BY id`,
    [CHUNKING_VERSION, EMBEDDING_MODEL]
  );
  for (const { id } of rows) {
    await enqueue("resources.rechunk", { resourceId: id }, { singletonKey: `resource-${id}` });
  }
  return { enqueued: rows.length };
};

defineJob("resources.rechunk", rechunkResourceJob, { policy: "stately" });
defineJob("resources.rechunk-sweep", rechunkSweepJob, { policy: "stately", retryLimit: 1 });
