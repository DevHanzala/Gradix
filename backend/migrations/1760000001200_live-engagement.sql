-- Up Migration
-- Phase 3 / section 3: quick polls and exit tickets inside a live session. (Teams use
-- live_participants.team and live_sessions.settings.teams; game points use live_answers.points.)

CREATE TABLE IF NOT EXISTS live_polls (
  id          SERIAL PRIMARY KEY,
  session_id  INTEGER     NOT NULL REFERENCES live_sessions (id) ON DELETE CASCADE,
  -- single / multiple choice, short open text, or the fixed exit-ticket template
  kind        VARCHAR(12) NOT NULL CHECK (kind IN ('single', 'multiple', 'text', 'exit_ticket')),
  question    TEXT,
  options     JSONB,
  anonymous   BOOLEAN     NOT NULL DEFAULT FALSE,
  status      VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at   TIMESTAMPTZ
);
-- At most one open poll per session.
CREATE UNIQUE INDEX IF NOT EXISTS uq_live_polls_open ON live_polls (session_id) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS live_poll_responses (
  id              SERIAL PRIMARY KEY,
  poll_id         INTEGER     NOT NULL REFERENCES live_polls (id) ON DELETE CASCADE,
  participant_id  INTEGER     NOT NULL REFERENCES live_participants (id) ON DELETE CASCADE,
  answer          JSONB       NOT NULL,
  answered_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (poll_id, participant_id)
);

-- Down Migration
DROP TABLE IF EXISTS live_poll_responses;
DROP TABLE IF EXISTS live_polls;
