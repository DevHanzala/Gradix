import pool from "../DB/db.js";

// ==================== USER CREATION ====================

export const createUserQuery = async (userData) => {
  const { name, email, hashedPassword, role, verificationToken, provider, uid } = userData;
  
  const query = `
    INSERT INTO users (name, email, password, role, verified, verification_token,
                       verification_token_expires, provider, uid, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '24 hours', $7, $8, NOW(), NOW())
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

export const linkGoogleAccountQuery = async (userId, uid) => {
  const query = `
    UPDATE users
    SET uid = $2, verified = true, verification_token = NULL, updated_at = NOW()
    WHERE id = $1
    RETURNING id, name, email, role, verified, provider, uid
  `;
  const result = await pool.query(query, [userId, uid]);
  return result.rows[0];
};

// ==================== USER LOOKUP ====================

// Case-insensitive: older accounts were stored with mixed-case emails.
export const findUserByEmailQuery = async (email) => {
  const query = "SELECT * FROM users WHERE LOWER(email) = LOWER($1) ORDER BY id LIMIT 1";
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

// Only unexpired tokens match. Rows created before expiry was tracked fall
// back to created_at + 24h.
export const findUserByVerificationTokenQuery = async (token) => {
  const query = `
    SELECT * FROM users
    WHERE verification_token = $1
      AND COALESCE(verification_token_expires, created_at + INTERVAL '24 hours') > NOW()
  `;
  const result = await pool.query(query, [token]);
  return result.rows[0] || null;
};

export const findUserByResetTokenQuery = async (resetId) => {
  const query = "SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()";
  const result = await pool.query(query, [resetId]);
  return result.rows[0] || null;
};

// ==================== USER VERIFICATION & PASSWORD ====================

export const verifyUserQuery = async (token) => {
  const query = `
    UPDATE users 
    SET verified = true, verification_token = NULL, verification_token_expires = NULL, updated_at = NOW() 
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
    WHERE LOWER(email) = LOWER($3) 
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

// ==================== USER SEARCH & FILTERING ====================

// ==================== USER STATISTICS ====================

export const setVerificationTokenQuery = async (userId, token) => {
  await pool.query(
    `UPDATE users
     SET verification_token = $2, verification_token_expires = NOW() + INTERVAL '24 hours', updated_at = NOW()
     WHERE id = $1`,
    [userId, token]
  );
};
