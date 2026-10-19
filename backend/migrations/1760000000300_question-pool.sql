-- Up Migration
-- Phase 2 / section 2: pre-generated question pool and publishing.

CREATE TABLE IF NOT EXISTS question_pool (
  id                   SERIAL PRIMARY KEY,
  assessment_id        INTEGER     NOT NULL REFERENCES assessments (id) ON DELETE CASCADE,
  objective_id         INTEGER     REFERENCES learning_objectives (id) ON DELETE CASCADE,
  question_type        VARCHAR(20) NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer')),
  difficulty           SMALLINT    NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  language             VARCHAR(10) NOT NULL,
  question_text        TEXT        NOT NULL,
  options              JSONB,
  correct_answer       JSONB       NOT NULL,
  stem_hash            CHAR(64)    NOT NULL,
  embedding            vector(384),
  source_chunk_ids     INTEGER[]   NOT NULL DEFAULT '{}',
  origin               VARCHAR(10) NOT NULL DEFAULT 'ai' CHECK (origin IN ('ai', 'manual')),
  -- Edits create a new version; the old row is retired (attempts keep their own copy).
  status               VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
  version              INTEGER     NOT NULL DEFAULT 1,
  previous_version_id  INTEGER     REFERENCES question_pool (id) ON DELETE SET NULL,
  approved_at          TIMESTAMPTZ,
  approved_by          INTEGER     REFERENCES users (id) ON DELETE SET NULL,
  times_served         INTEGER     NOT NULL DEFAULT 0,
  created_by           INTEGER     REFERENCES users (id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- No two active questions with the same stem in one assessment + language.
CREATE UNIQUE INDEX IF NOT EXISTS uq_question_pool_active_stem
  ON question_pool (assessment_id, language, stem_hash) WHERE status = 'active';
-- Serving looks up one bucket: assessment, language, objective, type, difficulty.
CREATE INDEX IF NOT EXISTS idx_question_pool_bucket
  ON question_pool (assessment_id, language, objective_id, question_type, difficulty) WHERE status = 'active';

-- Per-language pool readiness while publishing.
CREATE TABLE IF NOT EXISTS pool_language_state (
  assessment_id  INTEGER     NOT NULL REFERENCES assessments (id) ON DELETE CASCADE,
  language       VARCHAR(10) NOT NULL,
  state          VARCHAR(10) NOT NULL DEFAULT 'filling' CHECK (state IN ('filling', 'ready', 'failed')),
  error          TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (assessment_id, language)
);

ALTER TABLE assessments ADD COLUMN IF NOT EXISTS languages TEXT[] NOT NULL DEFAULT '{en,ur,ar}';
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

ALTER TABLE generated_questions ADD COLUMN IF NOT EXISTS pool_question_id INTEGER REFERENCES question_pool (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_generated_questions_pool ON generated_questions (pool_question_id);

-- Down Migration
DROP INDEX IF EXISTS idx_generated_questions_pool;
ALTER TABLE generated_questions DROP COLUMN IF EXISTS pool_question_id;
ALTER TABLE assessments DROP COLUMN IF EXISTS published_at;
ALTER TABLE assessments DROP COLUMN IF EXISTS languages;
DROP TABLE IF EXISTS pool_language_state;
DROP TABLE IF EXISTS question_pool;
