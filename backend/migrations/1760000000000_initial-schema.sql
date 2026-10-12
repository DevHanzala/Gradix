-- Up Migration
--
-- Full Gradix schema, inferred from every query in repositories/ and services/.
-- Written to be idempotent: it builds the schema from zero on an empty database
-- AND brings an existing (pre-migration) database up to date without dropping
-- data. Existing tables keep their original column types and constraints;
-- only missing columns and indexes are added.

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------- users ----------
CREATE TABLE IF NOT EXISTS users (
  id                          SERIAL PRIMARY KEY,
  name                        VARCHAR(255) NOT NULL,
  email                       VARCHAR(255) NOT NULL UNIQUE,
  password                    VARCHAR(255),
  role                        VARCHAR(50)  NOT NULL DEFAULT 'student'
                              CHECK (role IN ('student', 'instructor', 'admin', 'super_admin')),
  verified                    BOOLEAN      NOT NULL DEFAULT FALSE,
  verification_token          TEXT,
  verification_token_expires  TIMESTAMPTZ,
  provider                    VARCHAR(50)  NOT NULL DEFAULT 'manual',
  uid                         TEXT,
  reset_token                 TEXT,
  reset_token_expires         TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMPTZ;
-- Emails are matched case-insensitively (legacy rows may be mixed case).
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users (verification_token);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users (reset_token);
CREATE INDEX IF NOT EXISTS idx_users_uid ON users (uid);

-- ---------- assessments ----------
CREATE TABLE IF NOT EXISTS assessments (
  id              SERIAL PRIMARY KEY,
  title           VARCHAR(255) NOT NULL,
  prompt          TEXT,
  external_links  JSONB        NOT NULL DEFAULT '[]'::jsonb,
  instructor_id   INTEGER      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  is_executed     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assessments_instructor ON assessments (instructor_id);

-- ---------- question_blocks ----------
CREATE TABLE IF NOT EXISTS question_blocks (
  id                     SERIAL PRIMARY KEY,
  assessment_id          INTEGER          NOT NULL REFERENCES assessments (id) ON DELETE CASCADE,
  question_type          VARCHAR(50)      NOT NULL
                         CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer')),
  question_count         INTEGER          NOT NULL CHECK (question_count >= 1),
  duration_per_question  INTEGER          NOT NULL DEFAULT 120 CHECK (duration_per_question >= 30),
  num_options            INTEGER,
  positive_marks         DOUBLE PRECISION NOT NULL DEFAULT 1,
  negative_marks         DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_by             INTEGER          REFERENCES users (id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_question_blocks_assessment ON question_blocks (assessment_id);

-- ---------- enrollments ----------
CREATE TABLE IF NOT EXISTS enrollments (
  id             SERIAL PRIMARY KEY,
  assessment_id  INTEGER     NOT NULL REFERENCES assessments (id) ON DELETE CASCADE,
  student_id     INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  enrolled_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_enrollments_assessment_student
  ON enrollments (assessment_id, student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments (student_id);

-- ---------- resources ----------
CREATE TABLE IF NOT EXISTS resources (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  url           TEXT,
  file_type     VARCHAR(255),
  file_size     INTEGER,
  content_type  VARCHAR(20)  NOT NULL CHECK (content_type IN ('file', 'link')),
  visibility    VARCHAR(20)  NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  uploaded_by   INTEGER      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
ALTER TABLE resources ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS file_type VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_resources_uploaded_by ON resources (uploaded_by);

-- ---------- resource_chunks (embeddings) ----------
CREATE TABLE IF NOT EXISTS resource_chunks (
  id           SERIAL PRIMARY KEY,
  resource_id  INTEGER     NOT NULL REFERENCES resources (id) ON DELETE CASCADE,
  chunk_text   TEXT        NOT NULL,
  embedding    vector(384) NOT NULL,
  chunk_index  INTEGER     NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_resource_chunks_resource ON resource_chunks (resource_id, chunk_index);

-- ---------- assessment_resources ----------
CREATE TABLE IF NOT EXISTS assessment_resources (
  assessment_id  INTEGER     NOT NULL REFERENCES assessments (id) ON DELETE CASCADE,
  resource_id    INTEGER     NOT NULL REFERENCES resources (id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_resources
  ON assessment_resources (assessment_id, resource_id);

-- ---------- assessment_attempts ----------
CREATE TABLE IF NOT EXISTS assessment_attempts (
  id                           SERIAL PRIMARY KEY,
  student_id                   INTEGER          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  assessment_id                INTEGER          NOT NULL REFERENCES assessments (id) ON DELETE CASCADE,
  attempt_number               INTEGER          NOT NULL DEFAULT 1,
  language                     VARCHAR(10)      NOT NULL DEFAULT 'en',
  status                       VARCHAR(20)      NOT NULL DEFAULT 'in_progress',
  score                        DOUBLE PRECISION,
  is_physical_paper            BOOLEAN          NOT NULL DEFAULT FALSE,
  superseded                   BOOLEAN          NOT NULL DEFAULT FALSE,
  current_question_index       INTEGER          NOT NULL DEFAULT 0,
  current_question_started_at  TIMESTAMPTZ,
  started_at                   TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  completed_at                 TIMESTAMPTZ,
  created_at                   TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS is_physical_paper BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS superseded BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS current_question_index INTEGER NOT NULL DEFAULT 0;
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS current_question_started_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_attempts_student ON assessment_attempts (student_id);
CREATE INDEX IF NOT EXISTS idx_attempts_assessment ON assessment_attempts (assessment_id);

-- Existing databases may already contain retakes (the old code allowed them).
-- Keep each student's FIRST online attempt and flag the rest as superseded,
-- so the unique index below can be created. Nothing is deleted.
UPDATE assessment_attempts aa
SET superseded = TRUE
WHERE aa.is_physical_paper = FALSE
  AND aa.superseded = FALSE
  AND EXISTS (
    SELECT 1 FROM assessment_attempts earlier
    WHERE earlier.student_id = aa.student_id
      AND earlier.assessment_id = aa.assessment_id
      AND earlier.is_physical_paper = FALSE
      AND (earlier.started_at, earlier.id) < (aa.started_at, aa.id)
  );

-- One online attempt per student per assessment.
CREATE UNIQUE INDEX IF NOT EXISTS uq_attempts_one_online_per_student
  ON assessment_attempts (student_id, assessment_id)
  WHERE is_physical_paper = FALSE AND superseded = FALSE;

-- ---------- generated_questions ----------
CREATE TABLE IF NOT EXISTS generated_questions (
  id                     SERIAL PRIMARY KEY,
  attempt_id             INTEGER          NOT NULL REFERENCES assessment_attempts (id) ON DELETE CASCADE,
  question_order         INTEGER          NOT NULL,
  question_type          VARCHAR(50)      NOT NULL,
  question_text          TEXT             NOT NULL,
  options                JSONB,
  correct_answer         JSONB,
  positive_marks         DOUBLE PRECISION NOT NULL DEFAULT 1,
  negative_marks         DOUBLE PRECISION NOT NULL DEFAULT 0,
  duration_per_question  INTEGER          NOT NULL DEFAULT 120,
  created_at             TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_generated_questions_attempt
  ON generated_questions (attempt_id, question_order);

-- ---------- student_answers ----------
CREATE TABLE IF NOT EXISTS student_answers (
  id              SERIAL PRIMARY KEY,
  attempt_id      INTEGER          NOT NULL REFERENCES assessment_attempts (id) ON DELETE CASCADE,
  question_id     INTEGER          NOT NULL REFERENCES generated_questions (id) ON DELETE CASCADE,
  student_answer  TEXT,
  score           DOUBLE PRECISION,
  is_correct      BOOLEAN,
  answered_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);
ALTER TABLE student_answers ADD COLUMN IF NOT EXISTS is_correct BOOLEAN;
ALTER TABLE student_answers ADD COLUMN IF NOT EXISTS answered_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_answers_attempt_question
  ON student_answers (attempt_id, question_id);

-- Down Migration
--
-- Drops the whole schema. Only intended for local/test databases.
DROP TABLE IF EXISTS student_answers;
DROP TABLE IF EXISTS generated_questions;
DROP TABLE IF EXISTS assessment_attempts;
DROP TABLE IF EXISTS assessment_resources;
DROP TABLE IF EXISTS resource_chunks;
DROP TABLE IF EXISTS resources;
DROP TABLE IF EXISTS enrollments;
DROP TABLE IF EXISTS question_blocks;
DROP TABLE IF EXISTS assessments;
DROP TABLE IF EXISTS users;
