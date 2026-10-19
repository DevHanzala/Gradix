-- Up Migration
-- Phase 2 / section 3: one-question-at-a-time engine, adaptive difficulty, weighted scoring.

-- Live score display during an attempt (off by default: correctness stays hidden).
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS show_live_score BOOLEAN NOT NULL DEFAULT FALSE;

-- Attempt plan (snapshot of the blueprint slots: objective, type, duration, marks) and results.
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS plan JSONB;
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS adaptive BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS current_difficulty SMALLINT;
-- Time spent waiting for a question to be prepared is not charged to the student.
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS serve_delay_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS raw_score DOUBLE PRECISION;
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS raw_percentage DOUBLE PRECISION;
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS adjusted_score DOUBLE PRECISION;
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS adjusted_percentage DOUBLE PRECISION;
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS difficulty_path JSONB;

-- When each question was shown to the student.
ALTER TABLE generated_questions ADD COLUMN IF NOT EXISTS served_at TIMESTAMPTZ;

-- Per-answer grading (written when the question closes).
ALTER TABLE student_answers ADD COLUMN IF NOT EXISTS time_taken_seconds DOUBLE PRECISION;
ALTER TABLE student_answers ADD COLUMN IF NOT EXISTS timed_out BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE student_answers ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ;

-- A slot is served at most once per attempt (protects against two parallel requests).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM generated_questions GROUP BY attempt_id, question_order HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_generated_questions_attempt_order
      ON generated_questions (attempt_id, question_order);
  ELSE
    RAISE NOTICE 'Duplicate (attempt_id, question_order) rows exist; unique index not created';
  END IF;
END $$;

-- Down Migration
DROP INDEX IF EXISTS uq_generated_questions_attempt_order;
ALTER TABLE student_answers DROP COLUMN IF EXISTS graded_at;
ALTER TABLE student_answers DROP COLUMN IF EXISTS timed_out;
ALTER TABLE student_answers DROP COLUMN IF EXISTS time_taken_seconds;
ALTER TABLE generated_questions DROP COLUMN IF EXISTS served_at;
ALTER TABLE assessment_attempts DROP COLUMN IF EXISTS difficulty_path;
ALTER TABLE assessment_attempts DROP COLUMN IF EXISTS adjusted_percentage;
ALTER TABLE assessment_attempts DROP COLUMN IF EXISTS adjusted_score;
ALTER TABLE assessment_attempts DROP COLUMN IF EXISTS raw_percentage;
ALTER TABLE assessment_attempts DROP COLUMN IF EXISTS raw_score;
ALTER TABLE assessment_attempts DROP COLUMN IF EXISTS serve_delay_ms;
ALTER TABLE assessment_attempts DROP COLUMN IF EXISTS current_difficulty;
ALTER TABLE assessment_attempts DROP COLUMN IF EXISTS adaptive;
ALTER TABLE assessment_attempts DROP COLUMN IF EXISTS plan;
ALTER TABLE assessments DROP COLUMN IF EXISTS show_live_score;
