-- Up Migration
-- Phase 3 / section 8: embeddings may come from the local model (development) or the Gemini API
-- (production). Both are 384-dimensional, so the vector columns and HNSW indexes stay as they are; what
-- changes is the model, and vectors of different models must not be compared. Pool questions now record
-- their model like resources do, and the re-chunk sweep re-embeds anything made with another model.
ALTER TABLE question_pool ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100);
UPDATE question_pool SET embedding_model = 'Xenova/multilingual-e5-small' WHERE embedding IS NOT NULL AND embedding_model IS NULL;

-- Down Migration
ALTER TABLE question_pool DROP COLUMN IF EXISTS embedding_model;
