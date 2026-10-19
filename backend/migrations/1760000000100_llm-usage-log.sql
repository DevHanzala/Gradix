-- Up Migration
-- One row per LLM call, written by services/ai/generateContent.js (the only
-- function allowed to call an LLM). Used for cost tracking and debugging.
CREATE TABLE IF NOT EXISTS llm_usage_log (
  id                BIGSERIAL PRIMARY KEY,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  assessment_id     INTEGER      REFERENCES assessments (id) ON DELETE SET NULL,
  user_id           INTEGER      REFERENCES users (id) ON DELETE SET NULL,
  purpose           VARCHAR(60)  NOT NULL,
  provider          VARCHAR(30)  NOT NULL,
  model             VARCHAR(80),
  input_tokens      INTEGER,
  output_tokens     INTEGER,
  tokens_estimated  BOOLEAN      NOT NULL DEFAULT FALSE,
  latency_ms        INTEGER      NOT NULL,
  success           BOOLEAN      NOT NULL,
  error             TEXT
);
CREATE INDEX IF NOT EXISTS idx_llm_usage_created ON llm_usage_log (created_at);
CREATE INDEX IF NOT EXISTS idx_llm_usage_assessment ON llm_usage_log (assessment_id);
CREATE INDEX IF NOT EXISTS idx_llm_usage_purpose ON llm_usage_log (purpose);

-- Down Migration
DROP TABLE IF EXISTS llm_usage_log;
