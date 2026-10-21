-- Up Migration
-- Phase 2 / section 5: study plans, PDF reports and ungraded practice.

-- One report per attempt and language: the AI study plan and the rendered PDF.
CREATE TABLE IF NOT EXISTS learning_reports (
  id                SERIAL PRIMARY KEY,
  attempt_id        INTEGER     NOT NULL REFERENCES assessment_attempts (id) ON DELETE CASCADE,
  assessment_id     INTEGER     NOT NULL REFERENCES assessments (id) ON DELETE CASCADE,
  -- Nullable: account deletion anonymises results but keeps them.
  student_id        INTEGER     REFERENCES users (id) ON DELETE SET NULL,
  language          VARCHAR(10) NOT NULL,
  study_plan        JSONB,
  study_plan_source VARCHAR(10) CHECK (study_plan_source IN ('ai', 'fallback')),
  pdf               BYTEA,
  pdf_generated_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (attempt_id, language)
);
CREATE INDEX IF NOT EXISTS idx_learning_reports_student ON learning_reports (student_id);

-- Ungraded practice: freshly generated questions (never from the exam pool).
CREATE TABLE IF NOT EXISTS practice_sessions (
  id             SERIAL PRIMARY KEY,
  student_id     INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  assessment_id  INTEGER     NOT NULL REFERENCES assessments (id) ON DELETE CASCADE,
  language       VARCHAR(10) NOT NULL,
  questions      JSONB       NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_student ON practice_sessions (student_id, assessment_id);

-- Down Migration
DROP TABLE IF EXISTS practice_sessions;
DROP TABLE IF EXISTS learning_reports;
