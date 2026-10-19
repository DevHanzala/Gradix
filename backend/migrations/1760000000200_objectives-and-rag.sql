-- Up Migration
-- Phase 2 / section 1: learning objectives, blueprint, retrieval-ready chunks.

-- ---------- resources: keep the full extracted text for re-chunking ----------
ALTER TABLE resources ADD COLUMN IF NOT EXISTS content_text TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS content_hash CHAR(64);
ALTER TABLE resources ADD COLUMN IF NOT EXISTS language VARCHAR(10);
-- 1 = Phase 1 chunks (500 words, no overlap, English-only model); 2 = Phase 2 chunks.
ALTER TABLE resources ADD COLUMN IF NOT EXISTS chunking_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(80);
CREATE INDEX IF NOT EXISTS idx_resources_content_hash ON resources (content_hash);

-- ---------- resource_chunks ----------
ALTER TABLE resource_chunks ADD COLUMN IF NOT EXISTS token_count INTEGER;
ALTER TABLE resource_chunks ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(80);
-- Approximate nearest-neighbour search with cosine distance (operator <=>).
CREATE INDEX IF NOT EXISTS idx_resource_chunks_embedding_hnsw
  ON resource_chunks USING hnsw (embedding vector_cosine_ops);

-- ---------- assessments: lifecycle + blueprint ----------
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'draft';
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS objectives_state VARCHAR(20) NOT NULL DEFAULT 'idle';
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS objectives_error TEXT;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS blueprint JSONB;
-- Adaptive difficulty (Phase 2 / section 3); stored now because the blueprint depends on it.
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS adaptive BOOLEAN NOT NULL DEFAULT FALSE;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_assessments_status') THEN
    ALTER TABLE assessments ADD CONSTRAINT chk_assessments_status
      CHECK (status IN ('draft', 'objectives_ready', 'publishing', 'published'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_assessments_objectives_state') THEN
    ALTER TABLE assessments ADD CONSTRAINT chk_assessments_objectives_state
      CHECK (objectives_state IN ('idle', 'extracting', 'ready', 'failed'));
  END IF;
END $$;
-- Assessments that students already started under Phase 1 count as published.
UPDATE assessments SET status = 'published' WHERE is_executed = TRUE AND status = 'draft';

-- ---------- learning objectives ----------
CREATE TABLE IF NOT EXISTS learning_objectives (
  id                SERIAL PRIMARY KEY,
  assessment_id     INTEGER          NOT NULL REFERENCES assessments (id) ON DELETE CASCADE,
  text              TEXT             NOT NULL,
  description       TEXT,
  sort_order        INTEGER          NOT NULL,
  source_chunk_ids  INTEGER[]        NOT NULL DEFAULT '{}',
  weight            DOUBLE PRECISION NOT NULL DEFAULT 1 CHECK (weight > 0 AND weight <= 10),
  origin            VARCHAR(10)      NOT NULL DEFAULT 'ai' CHECK (origin IN ('ai', 'manual')),
  created_at        TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_learning_objectives_assessment ON learning_objectives (assessment_id, sort_order);

-- ---------- per-question metadata ----------
ALTER TABLE generated_questions ADD COLUMN IF NOT EXISTS objective_id INTEGER REFERENCES learning_objectives (id) ON DELETE SET NULL;
ALTER TABLE generated_questions ADD COLUMN IF NOT EXISTS difficulty SMALLINT CHECK (difficulty BETWEEN 1 AND 5);
ALTER TABLE generated_questions ADD COLUMN IF NOT EXISTS language VARCHAR(10);
ALTER TABLE generated_questions ADD COLUMN IF NOT EXISTS source_chunk_ids INTEGER[];
ALTER TABLE generated_questions ADD COLUMN IF NOT EXISTS stem_hash CHAR(64);

-- Down Migration
ALTER TABLE generated_questions DROP COLUMN IF EXISTS stem_hash;
ALTER TABLE generated_questions DROP COLUMN IF EXISTS source_chunk_ids;
ALTER TABLE generated_questions DROP COLUMN IF EXISTS language;
ALTER TABLE generated_questions DROP COLUMN IF EXISTS difficulty;
ALTER TABLE generated_questions DROP COLUMN IF EXISTS objective_id;
DROP TABLE IF EXISTS learning_objectives;
ALTER TABLE assessments DROP CONSTRAINT IF EXISTS chk_assessments_objectives_state;
ALTER TABLE assessments DROP CONSTRAINT IF EXISTS chk_assessments_status;
ALTER TABLE assessments DROP COLUMN IF EXISTS adaptive;
ALTER TABLE assessments DROP COLUMN IF EXISTS blueprint;
ALTER TABLE assessments DROP COLUMN IF EXISTS objectives_error;
ALTER TABLE assessments DROP COLUMN IF EXISTS objectives_state;
ALTER TABLE assessments DROP COLUMN IF EXISTS status;
DROP INDEX IF EXISTS idx_resource_chunks_embedding_hnsw;
ALTER TABLE resource_chunks DROP COLUMN IF EXISTS embedding_model;
ALTER TABLE resource_chunks DROP COLUMN IF EXISTS token_count;
DROP INDEX IF EXISTS idx_resources_content_hash;
ALTER TABLE resources DROP COLUMN IF EXISTS embedding_model;
ALTER TABLE resources DROP COLUMN IF EXISTS chunking_version;
ALTER TABLE resources DROP COLUMN IF EXISTS language;
ALTER TABLE resources DROP COLUMN IF EXISTS content_hash;
ALTER TABLE resources DROP COLUMN IF EXISTS content_text;
