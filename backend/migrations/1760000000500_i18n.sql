-- Up Migration
-- Phase 2 / section 4: per-user language and OCR provenance.

ALTER TABLE users ADD COLUMN IF NOT EXISTS language_preference VARCHAR(5) NOT NULL DEFAULT 'en';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_language_preference') THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_language_preference CHECK (language_preference IN ('en', 'ur', 'ar', 'fa'));
  END IF;
END $$;

-- How a resource's text was obtained: text | pdf_text | office | ocr_tesseract | ocr_gemini | link
ALTER TABLE resources ADD COLUMN IF NOT EXISTS extraction_method VARCHAR(20);

-- Down Migration
ALTER TABLE resources DROP COLUMN IF EXISTS extraction_method;
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_language_preference;
ALTER TABLE users DROP COLUMN IF EXISTS language_preference;
