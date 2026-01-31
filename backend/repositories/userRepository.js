import pool from "../DB/db.js";

// ==================== USER CREATION ====================

export const createUserQuery = async (userData) => {
  const { name, email, hashedPassword, role, verificationToken, provider, uid } = userData;
  
  const query = `
    INSERT INTO users (name, email, password, role, verified, verification_token, provider, uid, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
    RETURNING id, name, email, role, verified, provider, uid, created_at
  `;
  
  const values = [name, email, hashedPassword, role, false, verificationToken, provider, uid];
  const result = await pool.query(query, values);
  return result.rows[0];
};

export const createGoogleUserQuery = async (userData) => {
  const { name, email, role, uid } = userData;
  
  const query = `
    INSERT INTO users (name, email, role, verified, provider, uid, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    RETURNING id, name, email, role, verified, provider, uid, created_at
  `;
  
  const values = [name, email, role, true, "google", uid];
  const result = await pool.query(query, values);
  return result.rows[0];
};

// ==================== USER LOOKUP ====================

export const findUserByEmailQuery = async (email) => {
  const query = "SELECT * FROM users WHERE email = $1";
  const result = await pool.query(query, [email]);
  return result.rows[0] || null;
};

export const findUserByIdQuery = async (id) => {
  const query = "SELECT id, name, email, role, verified, provider, uid, created_at FROM users WHERE id = $1";
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

export const findUserByUIDQuery = async (uid) => {
  const query = "SELECT * FROM users WHERE uid = $1";
  const result = await pool.query(query, [uid]);
  return result.rows[0] || null;
};

export const findUserByVerificationTokenQuery = async (token) => {
  const query = "SELECT * FROM users WHERE verification_token = $1";
  const result = await pool.query(query, [token]);
  return result.rows[0] || null;
};

export const findUserByResetTokenQuery = async (resetId) => {
  const query = "SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()";
  const result = await pool.query(query, [resetId]);
  return result.rows[0] || null;
};

export const checkUserExistsByEmailQuery = async (email) => {
  const query = "SELECT id FROM users WHERE email = $1";
  const result = await pool.query(query, [email]);
  return result.rows.length > 0;
};

// ==================== USER VERIFICATION & PASSWORD ====================

export const verifyUserQuery = async (token) => {
  const query = `
    UPDATE users 
    SET verified = true, verification_token = NULL, updated_at = NOW() 
    WHERE verification_token = $1 
    RETURNING id, name, email, role, verified
  `;
  const result = await pool.query(query, [token]);
  return result.rows[0] || null;
};

export const updateResetTokenQuery = async (email, resetId, expiresAt) => {
  const query = `
    UPDATE users 
    SET reset_token = $1, reset_token_expires = $2, updated_at = NOW() 
    WHERE email = $3 
    RETURNING id, name, email
  `;
  const result = await pool.query(query, [resetId, expiresAt, email]);
  return result.rows[0] || null;
};

export const updatePasswordByIdQuery = async (userId, hashedPassword) => {
  const query = `
    UPDATE users 
    SET password = $1, updated_at = NOW() 
    WHERE id = $2 
    RETURNING id, name, email, role
  `;
  const result = await pool.query(query, [hashedPassword, userId]);
  return result.rows[0] || null;
};

// ==================== USER MANAGEMENT ====================

export const findAllUsersQuery = async () => {
  const query = `
    SELECT id, name, email, role, verified, created_at 
    FROM users 
    ORDER BY created_at DESC
  `;
  const result = await pool.query(query);
  return result.rows;
};

export const updateUserRoleQuery = async (userId, newRole) => {
  const query = `
    UPDATE users 
    SET role = $1, updated_at = NOW() 
    WHERE id = $2 
    RETURNING id, name, email, role, verified
  `;
  const result = await pool.query(query, [newRole, userId]);
  return result.rows[0] || null;
};

export const deleteUserQuery = async (userId) => {
  const query = "DELETE FROM users WHERE id = $1 RETURNING id, name, email";
  const result = await pool.query(query, [userId]);
  return result.rows[0] || null;
};

export const findRecentlyVerifiedUsersQuery = async () => {
  const query = `
    SELECT id, name, email, role, verified, created_at 
    FROM users 
    WHERE verified = true AND verification_token IS NULL
    AND updated_at > NOW() - INTERVAL '1 hour'
    ORDER BY updated_at DESC
    LIMIT 5
  `;
  const result = await pool.query(query);
  return result.rows;
};

// ==================== USER SEARCH & FILTERING ====================

export const findUsersByRoleQuery = async (role) => {
  const query = `
    SELECT id, name, email, role, verified, created_at 
    FROM users 
    WHERE role = $1 
    ORDER BY name ASC
  `;
  const result = await pool.query(query, [role]);
  return result.rows;
};

export const searchUsersQuery = async (searchTerm) => {
  const query = `
    SELECT id, name, email, role, verified, created_at 
    FROM users 
    WHERE name ILIKE $1 OR email ILIKE $1 
    ORDER BY name ASC
  `;
  const result = await pool.query(query, [`%${searchTerm}%`]);
  return result.rows;
};

// ==================== USER STATISTICS ====================

export const getUserStatsQuery = async () => {
  const query = `
    SELECT 
      COUNT(*) as total_users,
      COUNT(CASE WHEN role = 'student' THEN 1 END) as total_students,
      COUNT(CASE WHEN role = 'instructor' THEN 1 END) as total_instructors,
      COUNT(CASE WHEN role = 'admin' THEN 1 END) as total_admins,
      COUNT(CASE WHEN verified = true THEN 1 END) as verified_users,
      COUNT(CASE WHEN verified = false THEN 1 END) as unverified_users
    FROM users
  `;
  const result = await pool.query(query);
  return result.rows[0];
};