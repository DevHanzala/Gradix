import db, { withTransaction } from "../../DB/db.js";
import { AppError } from "../../utils/AppError.js";
import { normalizeText } from "../../utils/grading.js";
import { liveEvents } from "./liveEvents.js";

/**
 * Engagement inside a live session: quick polls (single choice, multiple choice,
 * short open text), the exit-ticket template, and teams for the team race.
 * Polls are never graded and never touch scores.
 */

export const POLL_LIMITS = { questionMax: 300, optionMax: 120, minOptions: 2, maxOptions: 6, textMax: 500 };
export const TEAM_LIMITS = { min: 2, max: 6 };
const POLL_KINDS = ["single", "multiple", "text", "exit_ticket"];

const bad = (code, message, status = 400) => new AppError(code, status, message);
const cleanText = (value, max) =>
  String(value ?? "")
    .normalize("NFC")
    .replace(/\p{C}/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, max);

// ------------------------------------------------------------------ polls

/** Validate a new poll; returns { kind, question, options, anonymous }. */
export const normalizePoll = (input = {}) => {
  const kind = POLL_KINDS.includes(input.kind) ? input.kind : null;
  if (!kind) throw bad("INVALID_POLL", "Choose a poll type.");
  const anonymous = input.anonymous === true;
  if (kind === "exit_ticket") return { kind, question: null, options: null, anonymous };
  const question = cleanText(input.question, POLL_LIMITS.questionMax);
  if (!question) throw bad("INVALID_POLL", "Write the poll question.");
  if (kind === "text") return { kind, question, options: null, anonymous };
  const options = (Array.isArray(input.options) ? input.options : []).map((o) => cleanText(o, POLL_LIMITS.optionMax)).filter(Boolean);
  if (options.length < POLL_LIMITS.minOptions || options.length > POLL_LIMITS.maxOptions) {
    throw bad("INVALID_POLL", `A choice poll needs ${POLL_LIMITS.minOptions} to ${POLL_LIMITS.maxOptions} options.`);
  }
  if (new Set(options.map(normalizeText)).size !== options.length) throw bad("INVALID_POLL", "Poll options must be different.");
  return { kind, question, options, anonymous };
};

/** Open a poll in a session (closing any poll that is still open). */
export const openPollService = async (session, input) => {
  if (session.status === "ended") throw bad("LIVE_ENDED", "This session has ended.", 409);
  const poll = normalizePoll(input);
  const created = await withTransaction(async (client) => {
    await client.query(`UPDATE live_polls SET status = 'closed', closed_at = NOW() WHERE session_id = $1 AND status = 'open'`, [session.id]);
    return (
      await client.query(
        `INSERT INTO live_polls (session_id, kind, question, options, anonymous) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [session.id, poll.kind, poll.question, poll.options ? JSON.stringify(poll.options) : null, poll.anonymous]
      )
    ).rows[0];
  });
  liveEvents.changed(session.id, "poll");
  return created;
};

export const closePollService = async (session, pollId) => {
  const { rows } = await db.query(
    `UPDATE live_polls SET status = 'closed', closed_at = NOW() WHERE id = $1 AND session_id = $2 AND status = 'open' RETURNING *`,
    [pollId, session.id]
  );
  if (!rows[0]) throw bad("POLL_NOT_OPEN", "This poll is not open.", 409);
  liveEvents.changed(session.id, "poll");
  return rows[0];
};

/** Check one response against its poll's kind; returns the value to store. */
export const normalizePollAnswer = (poll, answer) => {
  if (poll.kind === "single") {
    const choice = cleanText(answer, POLL_LIMITS.optionMax);
    if (!poll.options.includes(choice)) throw bad("INVALID_POLL_ANSWER", "Choose one of the options.");
    return choice;
  }
  if (poll.kind === "multiple") {
    const picks = [...new Set((Array.isArray(answer) ? answer : []).map((a) => cleanText(a, POLL_LIMITS.optionMax)))];
    if (!picks.length || !picks.every((p) => poll.options.includes(p))) throw bad("INVALID_POLL_ANSWER", "Choose at least one of the options.");
    return picks;
  }
  if (poll.kind === "text") {
    const text = cleanText(answer, POLL_LIMITS.textMax);
    if (!text) throw bad("INVALID_POLL_ANSWER", "Write an answer first.");
    return text;
  }
  // exit ticket: how well did you understand (1-5), one thing you learned, one question (optional)
  const understanding = Number(answer?.understanding);
  const learned = cleanText(answer?.learned, POLL_LIMITS.textMax);
  const question = cleanText(answer?.question, POLL_LIMITS.textMax);
  if (!Number.isInteger(understanding) || understanding < 1 || understanding > 5) throw bad("INVALID_POLL_ANSWER", "Choose how well you understood (1 to 5).");
  if (!learned) throw bad("INVALID_POLL_ANSWER", "Write one thing you learned.");
  return { understanding, learned, question: question || null };
};

/** A participant answers the open poll (one response each). */
export const respondPollService = async (participant, { pollId, answer }) => {
  const { rows } = await db.query(`SELECT * FROM live_polls WHERE id = $1 AND session_id = $2`, [pollId, participant.session_id]);
  const poll = rows[0];
  if (!poll || poll.status !== "open") throw bad("POLL_NOT_OPEN", "This poll is closed.", 409);
  const value = normalizePollAnswer(poll, answer);
  try {
    await db.query(`INSERT INTO live_poll_responses (poll_id, participant_id, answer) VALUES ($1, $2, $3)`, [poll.id, participant.id, JSON.stringify(value)]);
  } catch (error) {
    if (error.code === "23505") throw bad("POLL_ALREADY_ANSWERED", "You already answered this poll.", 409);
    throw error;
  }
  liveEvents.changed(participant.session_id, "poll_response");
  return { accepted: true };
};

/** The open poll as a participant sees it (no other people's answers). */
export const openPollFor = async (sessionId, participantId, client = db) => {
  const { rows } = await client.query(
    `SELECT p.*, r.answer AS my_answer FROM live_polls p
     LEFT JOIN live_poll_responses r ON r.poll_id = p.id AND r.participant_id = $2
     WHERE p.session_id = $1 AND p.status = 'open'`,
    [sessionId, participantId]
  );
  const p = rows[0];
  return p ? { id: p.id, kind: p.kind, question: p.question, options: p.options, anonymous: p.anonymous, myAnswer: p.my_answer ?? null } : null;
};

/** Every poll of a session with its results (teacher view). Names are hidden for anonymous polls. */
export const pollsForHost = async (sessionId, client = db) => {
  const { rows: polls } = await client.query(`SELECT * FROM live_polls WHERE session_id = $1 ORDER BY id`, [sessionId]);
  if (!polls.length) return [];
  const { rows: responses } = await client.query(
    `SELECT r.poll_id, r.answer, p.nickname FROM live_poll_responses r
     JOIN live_participants p ON p.id = r.participant_id AND p.removed_at IS NULL
     WHERE r.poll_id = ANY($1) ORDER BY r.id`,
    [polls.map((p) => p.id)]
  );
  return polls.map((poll) => {
    const mine = responses.filter((r) => r.poll_id === poll.id);
    const who = (r) => (poll.anonymous ? null : r.nickname);
    const view = {
      id: poll.id,
      kind: poll.kind,
      question: poll.question,
      options: poll.options,
      anonymous: poll.anonymous,
      status: poll.status,
      createdAt: poll.created_at,
      responses: mine.length,
    };
    if (poll.kind === "single" || poll.kind === "multiple") {
      view.tally = Object.fromEntries(poll.options.map((o) => [o, 0]));
      for (const r of mine) for (const choice of [].concat(r.answer)) if (choice in view.tally) view.tally[choice] += 1;
    } else if (poll.kind === "text") {
      view.texts = mine.map((r) => ({ nickname: who(r), text: r.answer }));
    } else {
      const scores = mine.map((r) => r.answer.understanding);
      view.exitTicket = {
        averageUnderstanding: scores.length ? Math.round((10 * scores.reduce((a, b) => a + b, 0)) / scores.length) / 10 : null,
        distribution: Object.fromEntries([1, 2, 3, 4, 5].map((n) => [n, scores.filter((s) => s === n).length])),
        learned: mine.map((r) => ({ nickname: who(r), text: r.answer.learned })),
        questions: mine.filter((r) => r.answer.question).map((r) => ({ nickname: who(r), text: r.answer.question })),
      };
    }
    return view;
  });
};

// ------------------------------------------------------------------ teams

/** Teams setting: 0 = off, otherwise 2 to 6 teams named "1".."N". */
export const teamCount = (settings) => {
  const n = Number(settings?.teams) || 0;
  return n >= TEAM_LIMITS.min && n <= TEAM_LIMITS.max ? n : 0;
};

/** Auto-assign: the team with the fewest active members (lowest number on ties). */
export const pickTeam = async (client, sessionId, count) => {
  const { rows } = await client.query(
    `SELECT team, count(*)::int AS n FROM live_participants WHERE session_id = $1 AND removed_at IS NULL AND team IS NOT NULL GROUP BY team`,
    [sessionId]
  );
  const sizes = new Map(rows.map((r) => [r.team, r.n]));
  let best = "1";
  for (let i = 1; i <= count; i++) {
    const team = String(i);
    if ((sizes.get(team) || 0) < (sizes.get(best) || 0)) best = team;
  }
  return best;
};

export const setParticipantTeamService = async (session, participantId, team) => {
  const count = teamCount(session.settings);
  if (!count) throw bad("LIVE_NO_TEAMS", "This session has no teams.", 409);
  const value = String(team);
  if (!/^\d$/.test(value) || Number(value) < 1 || Number(value) > count) throw bad("INVALID_TEAM", `Choose a team from 1 to ${count}.`);
  const { rows } = await db.query(`UPDATE live_participants SET team = $3 WHERE id = $1 AND session_id = $2 AND removed_at IS NULL RETURNING id`, [
    participantId,
    session.id,
    value,
  ]);
  if (!rows[0]) throw bad("LIVE_PARTICIPANT_NOT_FOUND", "Participant not found.", 404);
  liveEvents.changed(session.id, "teams");
};

/**
 * Team race standings: each correct answer moves a team forward. Progress is the
 * team's correct answers out of everything its members could answer, so team
 * size does not decide the race.
 */
export const teamStandings = (settings, participants, questionCount) => {
  const count = teamCount(settings);
  if (!count) return [];
  return Array.from({ length: count }, (_, i) => {
    const team = String(i + 1);
    const members = participants.filter((p) => p.team === team);
    const correct = members.reduce((s, p) => s + p.correct, 0);
    const possible = members.length * questionCount;
    return {
      team,
      members: members.length,
      correct,
      points: members.reduce((s, p) => s + p.points, 0),
      progress: possible ? Math.round((100 * correct) / possible) : 0,
    };
  });
};
