import pool from "../DB/db.js";

// ==================== RESOURCE CRUD ====================

export const createResourceQuery = async (resourceData) => {
  const { name, file_size, content_type, visibility, uploaded_by } = resourceData;
  
  const query = `
    INSERT INTO resources (name, file_size, content_type, visibility, uploaded_by)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  
  const { rows } = await pool.query(query, [name, file_size, content_type, visibility, uploaded_by]);
  return rows[0];
};

export const findResourcesByUploaderQuery = async (uploadedBy, visibility = null) => {
  let query = `
    SELECT r.*, u.name as uploader_name
    FROM resources r
    JOIN users u ON r.uploaded_by = u.id
    WHERE r.uploaded_by = $1
  `;
  const params = [uploadedBy];
  
  if (visibility) {
    query += ` AND r.visibility = $2`;
    params.push(visibility);
  }
  
  query += ` ORDER BY r.created_at DESC`;
  
  console.log("[DB QUERY] findResourcesByUploader", {
  uploadedBy,
  visibility
});

  const { rows } = await pool.query(query, params);
  return rows;
};

export const findAllResourcesQuery = async () => {
  const query = `
    SELECT r.*, u.name as uploader_name
    FROM resources r
    JOIN users u ON r.uploaded_by = u.id
    WHERE r.content_type = 'file'
    ORDER BY r.created_at DESC
  `;
  
  const { rows } = await pool.query(query);
  return rows;
};

export const findResourceByIdQuery = async (resourceId) => {
  console.log(`Fetching resource with ID: ${resourceId}`);
  const { rows } = await pool.query("SELECT * FROM resources WHERE id = $1", [resourceId]);
  return rows[0] || null;
};

export const updateResourceQuery = async (resourceId, updateData) => {
  const { name, visibility } = updateData;
  
  const query = `
    UPDATE resources
    SET name = COALESCE($1, name), visibility = COALESCE($2, visibility), updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING *
  `;
  
  const { rows } = await pool.query(query, [name, visibility, resourceId]);
  return rows[0] || null;
};

export const deleteResourceQuery = async (resourceId) => {
  const { rows } = await pool.query("DELETE FROM resources WHERE id = $1 RETURNING *", [resourceId]);
  return rows[0] || null;
};

// ==================== ASSESSMENT RESOURCES ====================

export const linkResourceToAssessmentQuery = async (assessmentId, resourceId) => {
  const query = `
    INSERT INTO assessment_resources (assessment_id, resource_id)
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING
    RETURNING *
  `;
  
  const { rows } = await pool.query(query, [assessmentId, resourceId]);
  return rows[0];
};

export const findAssessmentResourcesQuery = async (assessmentId) => {
  const query = `
    SELECT r.*, u.name as uploader_name
    FROM assessment_resources ar
    JOIN resources r ON ar.resource_id = r.id
    JOIN users u ON r.uploaded_by = u.id
    WHERE ar.assessment_id = $1
  `;
  
  const { rows } = await pool.query(query, [assessmentId]);
  return rows;
};

export const unlinkResourceFromAssessmentQuery = async (assessmentId, resourceId) => {
  const query = `
    DELETE FROM assessment_resources
    WHERE assessment_id = $1 AND resource_id = $2
    RETURNING *
  `;
  
  const { rows } = await pool.query(query, [assessmentId, resourceId]);
  return rows[0] || null;
};