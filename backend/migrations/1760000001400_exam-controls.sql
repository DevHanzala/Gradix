-- Up Migration
-- Phase 3 / section 5: light proctoring, exam windows, extra time and option shuffling.
--  assessments.exam_settings = { proctoring: off|log|warn|auto_submit, maxViolations, windowStart, windowEnd,
--                                lateJoinMinutes, timeZone, shuffleOptions }
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS exam_settings JSONB NOT NULL DEFAULT '{}';

-- Accommodation: this student's time per question is multiplied (e.g. 1.5 = 50% extra), applied by the server.
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS extra_time NUMERIC(3, 2) NOT NULL DEFAULT 1
  CHECK (extra_time >= 1 AND extra_time <= 3);

ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS time_multiplier NUMERIC(3, 2) NOT NULL DEFAULT 1;
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS proctoring_level VARCHAR(12);
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS proctoring_accepted_at TIMESTAMPTZ;
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS violation_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS auto_submitted_reason VARCHAR(40);

-- What the browser reported during an attempt: only these events, nothing else (no camera, no screen).
CREATE TABLE IF NOT EXISTS attempt_events (
  id           SERIAL PRIMARY KEY,
  attempt_id   INTEGER     NOT NULL REFERENCES assessment_attempts (id) ON DELETE CASCADE,
  kind         VARCHAR(20) NOT NULL CHECK (kind IN ('tab_hidden', 'window_blur', 'fullscreen_exit', 'copy', 'paste', 'context_menu')),
  question_index INTEGER,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attempt_events_attempt ON attempt_events (attempt_id, occurred_at);

-- Down Migration
DROP TABLE IF EXISTS attempt_events;
ALTER TABLE assessment_attempts DROP COLUMN IF EXISTS auto_submitted_reason;
ALTER TABLE assessment_attempts DROP COLUMN IF EXISTS violation_count;
ALTER TABLE assessment_attempts DROP COLUMN IF EXISTS proctoring_accepted_at;
ALTER TABLE assessment_attempts DROP COLUMN IF EXISTS proctoring_level;
ALTER TABLE assessment_attempts DROP COLUMN IF EXISTS time_multiplier;
ALTER TABLE enrollments DROP COLUMN IF EXISTS extra_time;
ALTER TABLE assessments DROP COLUMN IF EXISTS exam_settings;
