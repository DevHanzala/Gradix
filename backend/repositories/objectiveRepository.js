import db from "../DB/db.js";

export const findObjectivesQuery = async (assessmentId, client = db) => {
  const { rows } = await client.query(
    `SELECT id, assessment_id, text, description, sort_order, source_chunk_ids, weight, origin, created_at, updated_at
     FROM learning_objectives WHERE assessment_id = $1 ORDER BY sort_order, id`,
    [assessmentId]
  );
  return rows.map((r) => ({ ...r, weight: Number(r.weight) }));
};

export const insertObjectiveQuery = async (assessmentId, o, client = db) => {
  const { rows } = await client.query(
    `INSERT INTO learning_objectives (assessment_id, text, description, sort_order, source_chunk_ids, weight, origin)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [assessmentId, o.text, o.description || null, o.sort_order, o.source_chunk_ids || [], o.weight ?? 1, o.origin || "ai"]
  );
  return rows[0];
};

export const updateObjectiveQuery = async (id, o, client = db) => {
  await client.query(
    `UPDATE learning_objectives
     SET text = $2, description = $3, sort_order = $4, weight = $5, updated_at = NOW()
     WHERE id = $1`,
    [id, o.text, o.description || null, o.sort_order, o.weight]
  );
};

export const deleteObjectivesExceptQuery = async (assessmentId, keepIds, client = db) => {
  await client.query(`DELETE FROM learning_objectives WHERE assessment_id = $1 AND NOT (id = ANY($2::int[]))`, [
    assessmentId,
    keepIds,
  ]);
};

export const deleteAllObjectivesQuery = async (assessmentId, client = db) => {
  await client.query(`DELETE FROM learning_objectives WHERE assessment_id = $1`, [assessmentId]);
};

export const findAssessmentLifecycleQuery = async (assessmentId, client = db, { forUpdate = false } = {}) => {
  const { rows } = await client.query(
    `SELECT id, title, prompt, instructor_id, is_executed, status, objectives_state, objectives_error, blueprint
     FROM assessments WHERE id = $1 ${forUpdate ? "FOR UPDATE" : ""}`,
    [assessmentId]
  );
  return rows[0] || null;
};

export const setObjectivesStateQuery = async (assessmentId, { state, error = null, status }, client = db) => {
  await client.query(
    `UPDATE assessments
     SET objectives_state = $2, objectives_error = $3, status = COALESCE($4, status), updated_at = NOW()
     WHERE id = $1`,
    [assessmentId, state, error, status || null]
  );
};

export const saveBlueprintQuery = async (assessmentId, blueprint, client = db) => {
  await client.query(`UPDATE assessments SET blueprint = $2 WHERE id = $1`, [
    assessmentId,
    blueprint ? JSON.stringify(blueprint) : null,
  ]);
};
