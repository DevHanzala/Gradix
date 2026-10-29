-- Up Migration
-- Phase 3 / section 1: files live in the storage layer (local disk or Cloudflare R2), not in Postgres
-- and not on the server's disk. Columns hold storage keys; the files themselves are private.

-- The original uploaded file of a resource (NULL for links and for resources uploaded before Phase 3,
-- whose original was never kept: only its extracted text).
ALTER TABLE resources ADD COLUMN IF NOT EXISTS storage_key TEXT;

-- The rendered PDF report. The old BYTEA column stays for the move (scripts/migrateStorage.js copies
-- each PDF into storage and clears the column); new reports are written to storage only.
ALTER TABLE learning_reports ADD COLUMN IF NOT EXISTS pdf_storage_key TEXT;

-- Down Migration
ALTER TABLE learning_reports DROP COLUMN IF EXISTS pdf_storage_key;
ALTER TABLE resources DROP COLUMN IF EXISTS storage_key;
