import db from "../../DB/db.js";
import { embedQuery, toPgVector } from "../../helper/embeddingGenerator.js";

/**
 * Retrieval over an assessment's own resources (pgvector, cosine distance,
 * HNSW index). Only chunks of resources linked to the assessment are ever
 * candidates, so one instructor's material never leaks into another's exam.
 */

/** Number of chunks linked to an assessment. */
export const countAssessmentChunks = async (assessmentId, client = db) => {
  const { rows } = await client.query(
    `SELECT count(*)::int AS n
     FROM assessment_resources ar JOIN resource_chunks rc ON rc.resource_id = ar.resource_id
     WHERE ar.assessment_id = $1`,
    [assessmentId]
  );
  return rows[0].n;
};

/** Top-k chunks for a query. Returns [{ id, resource_id, resource_name, chunk_text, similarity }]. */
export const searchAssessmentChunks = async (assessmentId, queryText, k = 5, client = db) => {
  const vector = toPgVector(await embedQuery(queryText));
  const { rows } = await client.query(
    `SELECT rc.id, rc.resource_id, r.name AS resource_name, rc.chunk_text,
            1 - (rc.embedding <=> $2::vector) AS similarity, rc.embedding::text AS embedding
     FROM assessment_resources ar
     JOIN resource_chunks rc ON rc.resource_id = ar.resource_id
     JOIN resources r ON r.id = rc.resource_id
     WHERE ar.assessment_id = $1
     ORDER BY rc.embedding <=> $2::vector
     LIMIT $3`,
    [assessmentId, vector, k]
  );
  return rows.map((row) => ({ ...row, similarity: Number(row.similarity), embedding: parseVector(row.embedding) }));
};

/** Chunks by id, restricted to the assessment's resources (ids from the LLM are never trusted). */
export const findAssessmentChunksByIds = async (assessmentId, ids, client = db) => {
  const clean = [...new Set((ids || []).map(Number).filter(Number.isInteger))];
  if (clean.length === 0) return [];
  const { rows } = await client.query(
    `SELECT rc.id, rc.resource_id, r.name AS resource_name, rc.chunk_text
     FROM assessment_resources ar
     JOIN resource_chunks rc ON rc.resource_id = ar.resource_id
     JOIN resources r ON r.id = rc.resource_id
     WHERE ar.assessment_id = $1 AND rc.id = ANY($2::int[])
     ORDER BY rc.resource_id, rc.chunk_index`,
    [assessmentId, clean]
  );
  return rows;
};

const parseVector = (text) => (text ? JSON.parse(text) : null);

const cosine = (a, b) => {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
};

/**
 * Maximal marginal relevance: pick `k` candidates that are relevant to the
 * query but not near-duplicates of each other, so objectives are extracted
 * from the whole breadth of the material rather than its densest section.
 */
export const selectDiverse = (candidates, k, lambda = 0.6) => {
  const pool = [...candidates];
  const chosen = [];
  while (chosen.length < k && pool.length > 0) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    pool.forEach((candidate, i) => {
      const redundancy = chosen.length
        ? Math.max(...chosen.map((c) => (c.embedding && candidate.embedding ? cosine(c.embedding, candidate.embedding) : 0)))
        : 0;
      const score = lambda * candidate.similarity - (1 - lambda) * redundancy;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    });
    chosen.push(pool.splice(bestIndex, 1)[0]);
  }
  return chosen;
};
