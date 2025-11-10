import pool from "../DB/db.js"

/**
 * Creates a new AI configuration.
 * @param {Object} configData - AI configuration data.
 * @returns {Promise<Object>} The created AI configuration.
 */
export const createAIConfigTables = async (configData) => {

    if (!configData) {
    console.warn("⚠️ createAIConfigTables called without configData — skipping insert.");
    return;
  }

  const { provider, apiKey, modelName, costPerToken, createdBy } = configData
  
  const query = `
    INSERT INTO ai_configurations (provider, api_key, model_name, cost_per_token, created_by) 
    VALUES ($1, $2, $3, $4, $5) 
    RETURNING id, provider, model_name, is_active, cost_per_token, created_by, created_at
  `
  
  const { rows } = await pool.query(query, [provider, apiKey, modelName, costPerToken, createdBy])
  return rows[0]
}

/**
 * Gets all AI configurations (without API keys for security).
 * @returns {Promise<Array>} Array of AI configurations.
 */
export const getAllAIConfigs = async () => {
  const query = `
    SELECT id, provider, model_name, is_active, cost_per_token, created_by, created_at,
           u.name as created_by_name
    FROM ai_configurations ac
    JOIN users u ON ac.created_by = u.id
    ORDER BY ac.created_at DESC
  `
  const { rows } = await pool.query(query)
  return rows
}

/**
 * Gets active AI configurations for a specific provider.
 * @param {string} provider - The AI provider name.
 * @returns {Promise<Array>} Array of active configurations.
 */
export const getActiveAIConfigs = async (provider = null) => {
  let query = `
    SELECT * FROM ai_configurations 
    WHERE is_active = true
  `
  
  const params = []
  
  if (provider) {
    query += ` AND provider = $1`
    params.push(provider)
  }
  
  query += ` ORDER BY created_at DESC`
  
  const { rows } = await pool.query(query, params)
  return rows
}

/**
 * Updates an AI configuration.
 * @param {number} configId - The ID of the configuration to update.
 * @param {Object} updateData - Object containing fields to update.
 * @returns {Promise<Object|undefined>} The updated configuration.
 */
export const updateAIConfig = async (configId, updateData) => {
  const { apiKey, modelName, isActive, costPerToken } = updateData
  
  const query = `
    UPDATE ai_configurations 
    SET api_key = COALESCE($1, api_key),
        model_name = COALESCE($2, model_name),
        is_active = COALESCE($3, is_active),
        cost_per_token = COALESCE($4, cost_per_token)
    WHERE id = $5 
    RETURNING id, provider, model_name, is_active, cost_per_token, created_by, created_at
  `
  
  const { rows } = await pool.query(query, [apiKey, modelName, isActive, costPerToken, configId])
  return rows[0]
}

/**
 * Deletes an AI configuration.
 * @param {number} configId - The ID of the configuration to delete.
 * @returns {Promise<Object|undefined>} The deleted configuration.
 */
export const deleteAIConfig = async (configId) => {
  const query = `
    DELETE FROM ai_configurations 
    WHERE id = $1 
    RETURNING id, provider, model_name
  `
  const { rows } = await pool.query(query, [configId])
  return rows[0]
}

/**
 * Logs API usage for cost tracking.
 * @param {Object} usageData - Usage data object.
 * @returns {Promise<Object>} The created usage log.
 */
export const logAPIUsage = async (usageData) => {
  const {
    provider,
    modelName,
    tokensUsed,
    cost,
    operationType,
    userId,
    assessmentId
  } = usageData
  
  const query = `
    INSERT INTO api_usage_logs (provider, model_name, tokens_used, cost, operation_type, user_id, assessment_id) 
    VALUES ($1, $2, $3, $4, $5, $6, $7) 
    RETURNING *
  `
  
  const { rows } = await pool.query(query, [
    provider, modelName, tokensUsed, cost, operationType, userId, assessmentId
  ])
  
  return rows[0]
}

/**
 * Gets API usage statistics.
 * @param {Object} filters - Optional filters (dateFrom, dateTo, provider, userId).
 * @returns {Promise<Array>} Array of usage statistics.
 */
export const getAPIUsageStats = async (filters = {}) => {
  let query = `
    SELECT 
      provider,
      model_name,
      operation_type,
      COUNT(*) as request_count,
      SUM(tokens_used) as total_tokens,
      SUM(cost) as total_cost,
      DATE(created_at) as usage_date
    FROM api_usage_logs
    WHERE 1=1
  `
  
  const params = []
  let paramCount = 0
  
  if (filters.dateFrom) {
    paramCount++
    query += ` AND created_at >= $${paramCount}`
    params.push(filters.dateFrom)
  }
  
  if (filters.dateTo) {
    paramCount++
    query += ` AND created_at <= $${paramCount}`
    params.push(filters.dateTo)
  }
  
  if (filters.provider) {
    paramCount++
    query += ` AND provider = $${paramCount}`
    params.push(filters.provider)
  }
  
  if (filters.userId) {
    paramCount++
    query += ` AND user_id = $${paramCount}`
    params.push(filters.userId)
  }
  
  query += `
    GROUP BY provider, model_name, operation_type, DATE(created_at)
    ORDER BY usage_date DESC, total_cost DESC
  `
  
  const { rows } = await pool.query(query, params)
  return rows
}
