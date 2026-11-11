-- Up Migration
-- Phase 3 / section 7: plans (limits and prices in config/plans.js). Assigned by the Super Admin; a user's
-- effective plan is the higher of their own plan and the plans of the groups they belong to.
ALTER TABLE users  ADD COLUMN IF NOT EXISTS plan VARCHAR(20) NOT NULL DEFAULT 'free';
ALTER TABLE groups ADD COLUMN IF NOT EXISTS plan VARCHAR(20);

-- Down Migration
ALTER TABLE groups DROP COLUMN IF EXISTS plan;
ALTER TABLE users  DROP COLUMN IF EXISTS plan;
