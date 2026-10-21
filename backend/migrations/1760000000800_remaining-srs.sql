-- Up Migration
-- Phase 2 / section 7: negative-marking switch and the 30-second minimum in the database.

-- When off, wrong answers never lose marks, whatever the question blocks say.
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS negative_marking BOOLEAN NOT NULL DEFAULT TRUE;

-- Every question gets at least 30 seconds. Older rows below that are raised first.
UPDATE question_blocks SET duration_per_question = 30 WHERE duration_per_question < 30;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_question_blocks_min_duration') THEN
    ALTER TABLE question_blocks ADD CONSTRAINT chk_question_blocks_min_duration CHECK (duration_per_question >= 30);
  END IF;
END $$;

-- Library search over names.
CREATE INDEX IF NOT EXISTS idx_resources_uploader_created ON resources (uploaded_by, created_at DESC);

-- Down Migration
DROP INDEX IF EXISTS idx_resources_uploader_created;
ALTER TABLE question_blocks DROP CONSTRAINT IF EXISTS chk_question_blocks_min_duration;
ALTER TABLE assessments DROP COLUMN IF EXISTS negative_marking;
