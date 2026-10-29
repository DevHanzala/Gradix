-- Up Migration
-- Phase 3 / section 2: live classroom sessions. Every piece of state lives here (not in memory), so a
-- server restart or Render's sleep loses nothing; reconnecting clients rebuild their view from these rows.

CREATE TABLE IF NOT EXISTS live_sessions (
  id                   SERIAL PRIMARY KEY,
  code                 CHAR(6)     NOT NULL,
  instructor_id        INTEGER     REFERENCES users (id) ON DELETE SET NULL,
  assessment_id        INTEGER     REFERENCES assessments (id) ON DELETE SET NULL,
  title                VARCHAR(200) NOT NULL,
  source               VARCHAR(10) NOT NULL CHECK (source IN ('bank', 'ai')),
  language             VARCHAR(10) NOT NULL,
  pacing               VARCHAR(10) NOT NULL CHECK (pacing IN ('teacher', 'student')),
  question_mode        VARCHAR(10) NOT NULL CHECK (question_mode IN ('same', 'unique')),
  question_count       INTEGER     NOT NULL CHECK (question_count BETWEEN 1 AND 50),
  seconds_per_question INTEGER     NOT NULL CHECK (seconds_per_question BETWEEN 5 AND 600),
  -- Student-paced: the whole session must be finished within this many minutes of the start.
  time_limit_minutes   INTEGER     CHECK (time_limit_minutes BETWEEN 1 AND 240),
  settings             JSONB       NOT NULL DEFAULT '{}',
  -- lobby -> running <-> paused -> ended
  status               VARCHAR(10) NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'running', 'paused', 'ended')),
  -- Teacher-paced: the question everyone is on (-1 in the lobby) and its phase.
  current_index        INTEGER     NOT NULL DEFAULT -1,
  phase                VARCHAR(10) NOT NULL DEFAULT 'waiting' CHECK (phase IN ('waiting', 'question', 'closed', 'reveal')),
  question_started_at  TIMESTAMPTZ,
  question_deadline    TIMESTAMPTZ,
  paused_remaining_ms  INTEGER,
  started_at           TIMESTAMPTZ,
  ends_at              TIMESTAMPTZ,
  ended_at             TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- A join code identifies one open session at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_live_sessions_open_code ON live_sessions (code) WHERE status <> 'ended';
CREATE INDEX IF NOT EXISTS idx_live_sessions_instructor ON live_sessions (instructor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS live_participants (
  id                   SERIAL PRIMARY KEY,
  session_id           INTEGER     NOT NULL REFERENCES live_sessions (id) ON DELETE CASCADE,
  -- NULL for guests (nickname only). Guests exist only in live sessions, never in graded exams.
  user_id              INTEGER     REFERENCES users (id) ON DELETE SET NULL,
  nickname             VARCHAR(40) NOT NULL,
  team                 VARCHAR(40),
  -- Student-paced: this participant's own position and question start.
  current_index        INTEGER     NOT NULL DEFAULT 0,
  question_started_at  TIMESTAMPTZ,
  finished_at          TIMESTAMPTZ,
  score                INTEGER     NOT NULL DEFAULT 0,
  streak               INTEGER     NOT NULL DEFAULT 0,
  removed_at           TIMESTAMPTZ,
  joined_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_live_participants_user ON live_participants (session_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_live_participants_nickname
  ON live_participants (session_id, lower(nickname)) WHERE removed_at IS NULL;

-- Questions as served: one shared row per index ("same" mode, participant_id NULL), or one row per
-- participant and index ("unique" mode). A snapshot, so later bank edits never change a session.
CREATE TABLE IF NOT EXISTS live_questions (
  id                   SERIAL PRIMARY KEY,
  session_id           INTEGER     NOT NULL REFERENCES live_sessions (id) ON DELETE CASCADE,
  participant_id       INTEGER     REFERENCES live_participants (id) ON DELETE CASCADE,
  idx                  INTEGER     NOT NULL,
  pool_question_id     INTEGER     REFERENCES question_pool (id) ON DELETE SET NULL,
  question_type        VARCHAR(20) NOT NULL,
  question_text        TEXT        NOT NULL,
  options              JSONB,
  correct_answer       JSONB       NOT NULL,
  objective_id         INTEGER     REFERENCES learning_objectives (id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_live_questions_shared ON live_questions (session_id, idx) WHERE participant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_live_questions_own ON live_questions (participant_id, idx) WHERE participant_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS live_answers (
  id                   SERIAL PRIMARY KEY,
  session_id           INTEGER     NOT NULL REFERENCES live_sessions (id) ON DELETE CASCADE,
  participant_id       INTEGER     NOT NULL REFERENCES live_participants (id) ON DELETE CASCADE,
  live_question_id     INTEGER     NOT NULL REFERENCES live_questions (id) ON DELETE CASCADE,
  idx                  INTEGER     NOT NULL,
  answer               JSONB,
  is_correct           BOOLEAN     NOT NULL,
  response_ms          INTEGER     NOT NULL,
  points               INTEGER     NOT NULL DEFAULT 0,
  answered_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (participant_id, idx)
);
CREATE INDEX IF NOT EXISTS idx_live_answers_session ON live_answers (session_id, idx);

-- Down Migration
DROP TABLE IF EXISTS live_answers;
DROP TABLE IF EXISTS live_questions;
DROP TABLE IF EXISTS live_participants;
DROP TABLE IF EXISTS live_sessions;
