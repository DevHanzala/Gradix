-- Up Migration
-- Which API key served each LLM call (a label such as "gemini-2", never the key itself),
-- so daily free-plan usage can be tracked per key.
ALTER TABLE llm_usage_log ADD COLUMN IF NOT EXISTS key_label VARCHAR(40);
CREATE INDEX IF NOT EXISTS idx_llm_usage_key_created ON llm_usage_log (key_label, created_at);

-- Down Migration
DROP INDEX IF EXISTS idx_llm_usage_key_created;
ALTER TABLE llm_usage_log DROP COLUMN IF EXISTS key_label;
