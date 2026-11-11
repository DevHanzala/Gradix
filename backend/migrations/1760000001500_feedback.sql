-- Up Migration
-- Phase 3 / section 6: in-app feedback and the public contact form, read by the Super Admin.
CREATE TABLE IF NOT EXISTS feedback (
  id          SERIAL PRIMARY KEY,
  kind        VARCHAR(10)  NOT NULL CHECK (kind IN ('feedback', 'contact')),
  user_id     INTEGER      REFERENCES users (id) ON DELETE SET NULL,
  name        VARCHAR(120),
  email       VARCHAR(200),
  message     TEXT         NOT NULL,
  page        VARCHAR(300),
  language    VARCHAR(10),
  status      VARCHAR(10)  NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'done')),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback (created_at DESC);

-- Down Migration
DROP TABLE IF EXISTS feedback;
