-- Up Migration
-- Phase 3 / section 4: fill-in-the-blank and matching questions, and images on any question.
--  fill_blank: question_text holds [[1]], [[2]]... markers; correct_answer = {"blanks": [["accepted", ...], ...]}
--  matching:   options = {"left": [...], "right": [...]} (right column stored shuffled);
--              correct_answer = {"pairs": {"<left index>": "<right text>"}, "partial_credit": true|false}
--  images:     image = {"key": "<storage key>", "alt": "..."}; option_images = [image or null per MCQ option]

ALTER TABLE question_blocks DROP CONSTRAINT IF EXISTS question_blocks_question_type_check;
ALTER TABLE question_blocks ADD CONSTRAINT question_blocks_question_type_check
  CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer', 'fill_blank', 'matching'));

ALTER TABLE question_pool DROP CONSTRAINT IF EXISTS question_pool_question_type_check;
ALTER TABLE question_pool ADD CONSTRAINT question_pool_question_type_check
  CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer', 'fill_blank', 'matching'));

ALTER TABLE question_pool       ADD COLUMN IF NOT EXISTS image JSONB;
ALTER TABLE question_pool       ADD COLUMN IF NOT EXISTS option_images JSONB;
ALTER TABLE generated_questions ADD COLUMN IF NOT EXISTS image JSONB;
ALTER TABLE generated_questions ADD COLUMN IF NOT EXISTS option_images JSONB;
ALTER TABLE live_questions      ADD COLUMN IF NOT EXISTS image JSONB;
ALTER TABLE live_questions      ADD COLUMN IF NOT EXISTS option_images JSONB;

-- Down Migration
ALTER TABLE live_questions      DROP COLUMN IF EXISTS option_images;
ALTER TABLE live_questions      DROP COLUMN IF EXISTS image;
ALTER TABLE generated_questions DROP COLUMN IF EXISTS option_images;
ALTER TABLE generated_questions DROP COLUMN IF EXISTS image;
ALTER TABLE question_pool       DROP COLUMN IF EXISTS option_images;
ALTER TABLE question_pool       DROP COLUMN IF EXISTS image;
DELETE FROM question_pool WHERE question_type IN ('fill_blank', 'matching');
DELETE FROM question_blocks WHERE question_type IN ('fill_blank', 'matching');
ALTER TABLE question_pool DROP CONSTRAINT IF EXISTS question_pool_question_type_check;
ALTER TABLE question_pool ADD CONSTRAINT question_pool_question_type_check
  CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer'));
ALTER TABLE question_blocks DROP CONSTRAINT IF EXISTS question_blocks_question_type_check;
ALTER TABLE question_blocks ADD CONSTRAINT question_blocks_question_type_check
  CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer'));
