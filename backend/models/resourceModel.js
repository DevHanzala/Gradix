import pool from "../DB/db.js";

export const ensureResourcesTable = async () => {
  try {
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'resources'
      )
    `);
    if (!tableCheck.rows[0].exists) {
      console.log("Creating resources table...");
      await pool.query(`
        CREATE TABLE resources (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          file_size INTEGER,
          content_type VARCHAR(50) NOT NULL,
          visibility VARCHAR(50) NOT NULL DEFAULT 'private',
          uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("resources table created");
    }
  } catch (error) {
    console.error("Error creating resources table:", error);
    throw error;
  }
};

export const ensureResourceChunksTable = async () => {
  try {
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'resource_chunks'
      )
    `);
    if (!tableCheck.rows[0].exists) {
      console.log("Creating resource_chunks table...");
      await pool.query(`
        CREATE TABLE resource_chunks (
          id SERIAL PRIMARY KEY,
          resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
          chunk_text TEXT NOT NULL,
          embedding VECTOR(384),
          chunk_index INTEGER NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`
        CREATE INDEX idx_resource_chunks_resource_id ON resource_chunks(resource_id);
      `);
      console.log("resource_chunks table created");
    }
  } catch (error) {
    console.error("Error creating resource_chunks table:", error);
    throw error;
  }
};

// Initialize resource-related tables
export const init = async () => {
  try {
    if (!pool) {
      throw new Error("Database pool not initialized");
    }
    await ensureResourcesTable();
    await ensureResourceChunksTable();
    console.log("All resource-related tables initialized successfully");
  } catch (error) {
    console.error("Error initializing resource tables:", error);
    throw error;
  }
};

export const createResource = async (resourceData) => {
  // REMOVED file_path from destructuring
  const { name, file_size, content_type, visibility, uploaded_by } = resourceData;
  const query = `
    INSERT INTO resources (name, file_size, content_type, visibility, uploaded_by)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  try {
    const { rows } = await pool.query(query, [name, file_size, content_type, visibility, uploaded_by]);
    console.log(`Created resource: ID=${rows[0].id}`);
    return rows[0];
  } catch (error) {
    console.error("Error creating resource:", error);
    throw error;
  }
};

export const findResourcesByUploader = async (uploadedBy, visibility = null) => {
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
  
  try {
    const { rows } = await pool.query(query, params);
    return rows;
  } catch (error) {
    console.error("Error fetching resources by uploader:", error);
    throw error;
  }
};

export const findAllResources = async () => {
  const query = `
    SELECT r.*, u.name as uploader_name
    FROM resources r
    JOIN users u ON r.uploaded_by = u.id
    WHERE r.content_type = 'file'
    ORDER BY r.created_at DESC
  `;
  try {
    const { rows } = await pool.query(query);
    return rows;
  } catch (error) {
    console.error("Error fetching all resources:", error);
    throw error;
  }
};

export const findResourceById = async (resourceId) => {
  try {
    const { rows } = await pool.query("SELECT * FROM resources WHERE id = $1", [resourceId]);
    return rows[0] || null;
  } catch (error) {
    console.error("Error finding resource by ID:", error);
    throw error;
  }
};

export const updateResource = async (resourceId, updateData) => {
  const { name, visibility } = updateData;
  const query = `
    UPDATE resources
    SET name = COALESCE($1, name), visibility = COALESCE($2, visibility), updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING *
  `;
  try {
    const { rows } = await pool.query(query, [name, visibility, resourceId]);
    if (rows.length === 0) throw new Error("Resource not found");
    console.log(`Updated resource: ID=${resourceId}`);
    return rows[0];
  } catch (error) {
    console.error("Error updating resource:", error);
    throw error;
  }
};

export const deleteResource = async (resourceId) => {
  try {
    const { rows } = await pool.query("DELETE FROM resources WHERE id = $1 RETURNING *", [resourceId]);
    if (rows.length === 0) throw new Error("Resource not found");
    console.log(`Deleted resource: ID=${resourceId}`);
    return rows[0];
  } catch (error) {
    console.error("Error deleting resource:", error);
    throw error;
  }
};

export const linkResourceToAssessment = async (assessmentId, resourceId) => {
  try {
    if (!resourceId || isNaN(parseInt(resourceId))) {
      throw new Error(`Invalid resourceId: ${resourceId}`);
    }
    const resource = await findResourceById(resourceId);
    if (!resource) {
      throw new Error(`Resource not found: ID=${resourceId}`);
    }
    
    const query = `
      INSERT INTO assessment_resources (assessment_id, resource_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      RETURNING *
    `;
    const { rows } = await pool.query(query, [assessmentId, resourceId]);
    console.log(`Linked resource ${resourceId} to assessment ${assessmentId}`);
    return rows[0];
  } catch (error) {
    console.error("Error linking resource to assessment:", error);
    throw error;
  }
};

export const getAssessmentResources = async (assessmentId) => {
  try {
    const query = `
      SELECT r.*, u.name as uploader_name
      FROM assessment_resources ar
      JOIN resources r ON ar.resource_id = r.id
      JOIN users u ON r.uploaded_by = u.id
      WHERE ar.assessment_id = $1
    `;
    const { rows } = await pool.query(query, [assessmentId]);
    console.log(`Fetched ${rows.length} resources for assessment ${assessmentId}`);
    return rows;
  } catch (error) {
    console.error("Error fetching assessment resources:", error);
    throw error;
  }
};

export const unlinkResourceFromAssessment = async (assessmentId, resourceId) => {
  try {
    const query = `
      DELETE FROM assessment_resources
      WHERE assessment_id = $1 AND resource_id = $2
      RETURNING *
    `;
    const { rows } = await pool.query(query, [assessmentId, resourceId]);
    if (rows.length === 0) return null;
    console.log(`Unlinked resource ${resourceId} from assessment ${assessmentId}`);
    return rows[0];
  } catch (error) {
    console.error("Error unlinking resource from assessment:", error);
    throw error;
  }
};