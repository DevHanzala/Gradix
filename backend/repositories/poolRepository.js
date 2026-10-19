import db from "../DB/db.js";

const BUCKET_FILTER = `
  assessment_id = $1 AND language = $2 AND objective_id = $3 AND question_type = $4 AND difficulty = $5
  AND status = 'active'
  AND ($6::int IS NULL OR question_type <> 'multiple_choice' OR jsonb_array_length(options) = $6)`;

export const bucketParams = (assessmentId, language, b) => [
  assessmentId,
  language,
  b.objective_id,
  b.question_type,
  b.difficulty,
  b.num_options ?? null,
];

/** Active question counts per bucket for one language. */
export const countActiveByBucketQuery = async (assessmentId, language, client = db) => {
  const { rows } = await client.query(
    `SELECT objective_id, question_type, difficulty,
            CASE WHEN question_type = 'multiple_choice' THEN jsonb_array_length(options) END AS num_options,
            count(*)::int AS n, COALESCE(sum(times_served), 0)::int AS served
     FROM question_pool
     WHERE assessment_id = $1 AND language = $2 AND status = 'active'
     GROUP BY 1, 2, 3, 4`,
    [assessmentId, language]
  );
  return rows;
};

export const findActiveHashesQuery = async (assessmentId, language, client = db) => {
  const { rows } = await client.query(
    `SELECT stem_hash, question_text, embedding::text AS embedding
     FROM question_pool WHERE assessment_id = $1 AND language = $2 AND status = 'active'`,
    [assessmentId, language]
  );
  return rows.map((r) => ({ ...r, embedding: r.embedding ? JSON.parse(r.embedding) : null }));
};

export const insertPoolQuestionQuery = async (assessmentId, q, client = db) => {
  const { rows } = await client.query(
    `INSERT INTO question_pool
       (assessment_id, objective_id, question_type, difficulty, language, question_text, options, correct_answer,
        stem_hash, embedding, source_chunk_ids, origin, version, previous_version_id, approved_at, approved_by, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::vector, $11, $12, $13, $14, $15, $16, $17)
     ON CONFLICT (assessment_id, language, stem_hash) WHERE status = 'active' DO NOTHING
     RETURNING id`,
    [
      assessmentId,
      q.objective_id,
      q.question_type,
      q.difficulty,
      q.language,
      q.question_text,
      q.options ? JSON.stringify(q.options) : null,
      JSON.stringify(q.correct_answer),
      q.stem_hash,
      q.embedding || null,
      q.source_chunk_ids || [],
      q.origin || "ai",
      q.version || 1,
      q.previous_version_id || null,
      q.approved_at || null,
      q.approved_by || null,
      q.created_by || null,
    ]
  );
  return rows[0] || null;
};

/**
 * Candidates for one bucket that this attempt has not seen, least served
 * first (spreads exposure across students), random among equals.
 */
export const findBucketCandidatesQuery = async (assessmentId, language, bucket, excludeIds, client = db) => {
  const { rows } = await client.query(
    `SELECT id, objective_id, question_type, difficulty, language, question_text, options, correct_answer,
            stem_hash, source_chunk_ids, times_served
     FROM question_pool
     WHERE ${BUCKET_FILTER} AND NOT (id = ANY($7::int[]))
     ORDER BY times_served ASC, random()
     LIMIT 25`,
    [...bucketParams(assessmentId, language, bucket), excludeIds]
  );
  return rows;
};

export const incrementServedQuery = async (poolId, client = db) => {
  await client.query(`UPDATE question_pool SET times_served = times_served + 1 WHERE id = $1`, [poolId]);
};

export const findPoolQuestionQuery = async (assessmentId, poolId, client = db, { forUpdate = false } = {}) => {
  const { rows } = await client.query(
    `SELECT * FROM question_pool WHERE assessment_id = $1 AND id = $2 ${forUpdate ? "FOR UPDATE" : ""}`,
    [assessmentId, poolId]
  );
  return rows[0] || null;
};

export const retirePoolQuestionQuery = async (poolId, client = db) => {
  await client.query(`UPDATE question_pool SET status = 'retired', updated_at = NOW() WHERE id = $1`, [poolId]);
};

export const setLanguageStateQuery = async (assessmentId, language, state, error = null, client = db) => {
  await client.query(
    `INSERT INTO pool_language_state (assessment_id, language, state, error, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (assessment_id, language) DO UPDATE SET state = EXCLUDED.state, error = EXCLUDED.error, updated_at = NOW()`,
    [assessmentId, language, state, error]
  );
};

export const findLanguageStatesQuery = async (assessmentId, client = db) => {
  const { rows } = await client.query(
    `SELECT language, state, error, updated_at FROM pool_language_state WHERE assessment_id = $1 ORDER BY language`,
    [assessmentId]
  );
  return rows;
};
