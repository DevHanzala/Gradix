import db from "../DB/db.js";
import { toPgVector } from "../helper/embeddingGenerator.js";

// ==================== ASSESSMENT CRUD ====================

export const createAssessmentQuery = async (assessmentData, client = db) => {
  const { title, prompt, external_links, instructor_id, is_executed = false, adaptive = false, show_live_score = false, negative_marking = true } = assessmentData;
  
  const query = `
    INSERT INTO assessments (title, prompt, external_links, instructor_id, is_executed, adaptive, show_live_score, negative_marking)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;
  
  const validExternalLinks = Array.isArray(external_links) 
    ? external_links.filter(link => link && typeof link === "string" && link.trim() !== "") 
    : [];
  
  const { rows } = await client.query(query, [
    title || null, 
    prompt, 
    JSON.stringify(validExternalLinks), 
    instructor_id, 
    is_executed,
    adaptive,
    show_live_score,
    negative_marking,
  ]);
  
  return rows[0];
};

export const findAssessmentsByInstructorQuery = async (instructorId) => {
  const query = `
    SELECT a.*, 
           COALESCE(
             (SELECT json_agg(
                json_build_object(
                  'id', qb.id,
                  'question_type', qb.question_type,
                  'question_count', qb.question_count,
                  'duration_per_question', COALESCE(qb.duration_per_question, 180),
                  'num_options', qb.num_options,
                  'positive_marks', qb.positive_marks,
                  'negative_marks', qb.negative_marks
                )
             ) FROM question_blocks qb WHERE qb.assessment_id = a.id),
             '[]'
           ) as question_blocks,
           COALESCE(
             (SELECT json_agg(
                json_build_object(
                  'id', r.id,
                  'name', r.name,
                  'content_type', r.content_type
                )
             ) FROM assessment_resources ar JOIN resources r ON ar.resource_id = r.id WHERE ar.assessment_id = a.id),
             '[]'
           ) as resources
    FROM assessments a
    WHERE a.instructor_id = $1
    ORDER BY a.created_at DESC
  `;
  
  const { rows } = await db.query(query, [instructorId]);
  return rows;
};

export const findAssessmentByIdForInstructorQuery = async (assessmentId, userId) => {
  const query = `
    SELECT
      a.*,

      /* ---------- Question Blocks (NO duplication) ---------- */
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'question_type', qb.question_type,
              'question_count', qb.question_count,
              'duration_per_question', COALESCE(qb.duration_per_question, 180),
              'num_options', qb.num_options,
              'positive_marks', qb.positive_marks,
              'negative_marks', qb.negative_marks
            )
            ORDER BY qb.id
          )
          FROM question_blocks qb
          WHERE qb.assessment_id = a.id
        ),
        '[]'
      ) AS question_blocks,

      /* ---------- Resources (NO duplication) ---------- */
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', r.id,
              'name', r.name
            )
            ORDER BY r.id
          )
          FROM assessment_resources ar
          JOIN resources r ON r.id = ar.resource_id
          WHERE ar.assessment_id = a.id
        ),
        '[]'
      ) AS resources

    FROM assessments a
    WHERE a.id = $1
      AND a.instructor_id = $2
  `;

  const { rows } = await db.query(query, [assessmentId, userId]);
  return rows[0] || null;
};


export const findAssessmentByIdForStudentQuery = async (assessmentId, studentId) => {
  const query = `
    SELECT
      a.*,

      /* ---------- Question Blocks ---------- */
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'question_type', qb.question_type,
              'question_count', qb.question_count,
              'duration_per_question', COALESCE(qb.duration_per_question, 180),
              'num_options', qb.num_options,
              'positive_marks', qb.positive_marks,
              'negative_marks', qb.negative_marks
            )
            ORDER BY qb.id
          )
          FROM question_blocks qb
          WHERE qb.assessment_id = a.id
        ),
        '[]'
      ) AS question_blocks,

      /* ---------- Resources ---------- */
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', r.id,
              'name', r.name,
              'content_type', r.content_type
            )
            ORDER BY r.id
          )
          FROM assessment_resources ar
          JOIN resources r ON r.id = ar.resource_id
          WHERE ar.assessment_id = a.id
        ),
        '[]'
      ) AS resources

    FROM assessments a
    JOIN enrollments e ON a.id = e.assessment_id
    WHERE a.id = $1
      AND e.student_id = $2
  `;

  const { rows } = await db.query(query, [assessmentId, studentId]);
  return rows[0] || null;
};

export const updateAssessmentQuery = async (assessmentId, updateData, client = db) => {
  const { title, prompt, external_links, adaptive, show_live_score, negative_marking } = updateData;
  
  const validExternalLinks = Array.isArray(external_links) 
    ? external_links.filter(link => link && typeof link === "string" && link.trim() !== "") 
    : [];
  
  const query = `
    UPDATE assessments
    SET title = $1, prompt = $2, external_links = $3,
        adaptive = COALESCE($5, adaptive), show_live_score = COALESCE($6, show_live_score),
        negative_marking = COALESCE($7, negative_marking), updated_at = NOW()
    WHERE id = $4
    RETURNING *
  `;
  
  const { rows } = await client.query(query, [
    title || null,
    prompt,
    JSON.stringify(validExternalLinks),
    assessmentId,
    adaptive ?? null,
    show_live_score ?? null,
    negative_marking ?? null,
  ]);
  
  return rows[0] || null;
};

export const deleteAssessmentQuery = async (assessmentId) => {
  const { rows } = await db.query(
    "DELETE FROM assessments WHERE id = $1 RETURNING *", 
    [assessmentId]
  );
  return rows[0] || null;
};

// ==================== QUESTION BLOCKS ====================

export const deleteQuestionBlocksByAssessmentQuery = async (assessmentId, client = db) => {
  await client.query("DELETE FROM question_blocks WHERE assessment_id = $1", [assessmentId]);
};

export const createQuestionBlockQuery = async (blockData, client = db) => {
  const {
    assessmentId,
    question_type,
    question_count,
    duration_per_question,
    num_options,
    positive_marks,
    negative_marks,
    instructorId,
  } = blockData;
  
  const query = `
    INSERT INTO question_blocks (
      assessment_id, 
      question_type, 
      question_count, 
      duration_per_question, 
      num_options, 
      positive_marks, 
      negative_marks, 
      created_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;
  
  const { rows } = await client.query(query, [
    assessmentId,
    question_type,
    question_count,
    duration_per_question || 120,
    num_options || null,
    positive_marks !== undefined ? Number(positive_marks) : 1,
    negative_marks !== undefined ? Number(negative_marks) : 0,
    instructorId,
  ]);
  
  return rows[0];
};

export const findQuestionBlocksByAssessmentQuery = async (assessmentId, client = db) => {
  const query = `
    SELECT question_type, question_count, duration_per_question, num_options, positive_marks, negative_marks
    FROM question_blocks
    WHERE assessment_id = $1
    ORDER BY id
  `;
  const { rows } = await client.query(query, [assessmentId]);
  return rows;
};

// ==================== ENROLLMENTS ====================

export const createEnrollmentQuery = async (assessmentId, studentId, client = db) => {
  const query = `
    INSERT INTO enrollments (assessment_id, student_id)
    VALUES ($1, $2)
    RETURNING *
  `;
  const { rows } = await client.query(query, [assessmentId, studentId]);
  return rows[0];
};

export const deleteEnrollmentQuery = async (assessmentId, studentId) => {
  const { rows } = await db.query(
    "DELETE FROM enrollments WHERE assessment_id = $1 AND student_id = $2 RETURNING *",
    [assessmentId, studentId]
  );
  return rows[0] || null;
};

export const findEnrolledStudentsQuery = async (assessmentId) => {
  const query = `
    SELECT u.id, u.email, u.name
    FROM enrollments e
    JOIN users u ON e.student_id = u.id
    WHERE e.assessment_id = $1
  `;
  const { rows } = await db.query(query, [assessmentId]);
  return rows;
};

// ==================== RESOURCE CHUNKS ====================

export const createResourceChunkQuery = async (chunkData, client = db) => {
  const { resourceId, chunkText, embedding, chunkIndex, tokenCount = null, embeddingModel = null } = chunkData;

  const query = `
    INSERT INTO resource_chunks (resource_id, chunk_text, embedding, chunk_index, token_count, embedding_model)
    VALUES ($1, $2, $3::vector, $4, $5, $6)
    RETURNING id, resource_id, chunk_index, token_count
  `;

  const values = [resourceId, chunkText, toPgVector(embedding), chunkIndex, tokenCount, embeddingModel];
  const { rows } = await client.query(query, values);
  return rows[0];
};

export const findResourceChunksByAssessmentQuery = async (assessmentId) => {
  const query = `
    SELECT r.name, rc.chunk_text
    FROM assessment_resources ar
    JOIN resources r ON ar.resource_id = r.id
    LEFT JOIN resource_chunks rc ON rc.resource_id = r.id
    WHERE ar.assessment_id = $1
    ORDER BY r.id, rc.chunk_index
  `;
  const { rows } = await db.query(query, [assessmentId]);
  return rows;
};

// ==================== ASSESSMENT RESOURCES ====================

export const findAssessmentResourceIdsQuery = async (assessmentId, client = db) => {
  const { rows } = await client.query(
    `SELECT resource_id FROM assessment_resources WHERE assessment_id = $1 ORDER BY resource_id`,
    [assessmentId]
  );
  return rows.map((r) => r.resource_id);
};

export const linkResourceToAssessmentQuery = async (assessmentId, resourceId, client = db) => {
  const query = `
    INSERT INTO assessment_resources (assessment_id, resource_id)
    VALUES ($1, $2)
    ON CONFLICT (assessment_id, resource_id) DO NOTHING
    RETURNING *
  `;
  const { rows } = await client.query(query, [assessmentId, resourceId]);
  return rows[0];
};

// ==================== GENERATED QUESTIONS ====================

// ==================== ASSESSMENT ATTEMPTS ====================

export const deleteAssessmentResourceLinksQuery = async (assessmentId, client = db) => {
  await client.query(`DELETE FROM assessment_resources WHERE assessment_id = $1`, [assessmentId]);
};
