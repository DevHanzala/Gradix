-- Up Migration
-- Phase 2 / section 6: groups, notifications, anonymising account deletion.

CREATE TABLE IF NOT EXISTS groups (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(150) NOT NULL,
  description  TEXT,
  created_by   INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_groups_name ON groups (LOWER(name));

CREATE TABLE IF NOT EXISTS group_memberships (
  group_id    INTEGER NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  added_by    INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_memberships_user ON group_memberships (user_id);

-- In-app notifications. Text is rendered by the client from `type` + `data`
-- in the reader's language, so rows are language-neutral.
CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type        VARCHAR(40) NOT NULL,
  data        JSONB NOT NULL DEFAULT '{}',
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at DESC);

-- Deleted accounts are anonymised (results kept) instead of removed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Down Migration
ALTER TABLE users DROP COLUMN IF EXISTS deleted_at;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS group_memberships;
DROP TABLE IF EXISTS groups;
