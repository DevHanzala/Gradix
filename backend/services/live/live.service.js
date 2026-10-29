import { randomInt } from "crypto";
import jwt from "jsonwebtoken";
import db, { withTransaction } from "../../DB/db.js";
import { AppError } from "../../utils/AppError.js";
import { canonicalOption, isAnswerCorrect, isAnswered, decodeStoredValue, normalizeText, questionOptions, correctAnswerText, canonicalStudentAnswer } from "../../utils/grading.js";
import { requireAssessmentAccess } from "../assessmentAccess.js";
import { generateContent } from "../ai/generateContent.js";
import { validateQuestion, LANGUAGES } from "../questions/validation.js";
import { liveEvents } from "./liveEvents.js";
import { openPollFor, pollsForHost, pickTeam, teamCount, teamStandings, TEAM_LIMITS } from "./engagement.service.js";

/**
 * Live classroom sessions.
 *
 * The server is the only authority on timing and scoring: every deadline is a
 * timestamp in live_sessions / live_participants, every answer is checked against
 * it, and correct answers leave the server only at reveal (teacher-paced) or
 * after the participant has answered that question (student-paced).
 *
 * Teacher-paced: lobby -> question (timer) -> closed (time up or all answered)
 *                -> reveal -> next question ... -> ended.
 * Student-paced: each participant moves through their own questions within
 *                the session's time limit (ends_at).
 */

export const LIVE_LIMITS = {
  maxQuestions: 50,
  nicknameMax: 30,
  defaultMaxParticipants: 300,
  // Answers that arrive this long after the deadline still count (network latency).
  graceMs: 750,
  tokenTtl: "12h",
};
export const DEFAULT_SETTINGS = { game: false, showLeaderboard: true, sounds: true, anonymousNames: false, teams: 0 };

const bad = (code, message, status = 400) => new AppError(code, status, message);
const now = () => Date.now();
const ms = (date) => (date ? new Date(date).getTime() : null);

// ------------------------------------------------------------------ scoring

/**
 * Points for one answer: 500 for a correct answer, up to 500 more for speed and
 * 100 per streak step (max 500). Wrong or missing: 0. Game mode shows points;
 * otherwise results show correct answers and accuracy.
 */
export const computePoints = ({ correct, responseMs, durationMs, streak }) => {
  if (!correct) return 0;
  const speed = durationMs > 0 ? Math.max(0, 1 - responseMs / durationMs) : 0;
  return 500 + Math.round(500 * speed) + Math.min(5, Math.max(0, streak - 1)) * 100;
};

// ------------------------------------------------------------------- tokens

const liveSecret = () => `${process.env.JWT_SECRET}:live-participant`;

/** A participant token works only for live endpoints (signed with a different secret than login tokens). */
export const signParticipantToken = (sessionId, participantId) =>
  jwt.sign({ typ: "live", sid: sessionId, pid: participantId }, liveSecret(), { expiresIn: LIVE_LIMITS.tokenTtl });

export const verifyParticipantToken = (token) => {
  try {
    const decoded = jwt.verify(String(token || ""), liveSecret());
    if (decoded.typ !== "live") throw new Error("wrong type");
    return { sessionId: decoded.sid, participantId: decoded.pid };
  } catch {
    throw bad("LIVE_TOKEN_INVALID", "Your place in this session has expired. Join again with the code.", 401);
  }
};

// ---------------------------------------------------------------- creation

const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

const intIn = (value, min, max, fallback) => {
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n)) return fallback;
  if (n < min || n > max) throw bad("INVALID_LIVE_SETTINGS", `A value must be between ${min} and ${max}.`);
  return n;
};

export const normalizeSettings = (raw = {}, base = DEFAULT_SETTINGS) => {
  const out = { ...base };
  for (const key of ["game", "showLeaderboard", "sounds", "anonymousNames"]) {
    if (raw[key] !== undefined) out[key] = raw[key] === true;
  }
  if (raw.teams !== undefined && raw.teams !== null && raw.teams !== "") {
    const teams = Number.parseInt(raw.teams, 10);
    if (!(teams === 0 || (teams >= TEAM_LIMITS.min && teams <= TEAM_LIMITS.max))) {
      throw bad("INVALID_LIVE_SETTINGS", `Teams: 0 (no teams) or ${TEAM_LIMITS.min} to ${TEAM_LIMITS.max}.`);
    }
    out.teams = teams;
  }
  return out;
};

/** Spread `count` picks over objectives round-robin, random within each objective. */
const spreadPick = (rows, count) => {
  const byObjective = new Map();
  for (const row of rows.sort(() => Math.random() - 0.5)) {
    const key = row.objective_id ?? "none";
    if (!byObjective.has(key)) byObjective.set(key, []);
    byObjective.get(key).push(row);
  }
  const queues = [...byObjective.values()];
  const picked = [];
  for (let i = 0; picked.length < count && queues.some((q) => q.length); i++) {
    const queue = queues[i % queues.length];
    if (queue.length) picked.push(queue.shift());
  }
  return picked;
};

const POOL_TYPES = ["multiple_choice", "true_false", "short_answer", "fill_blank", "matching"];

const bankQuestions = async (assessmentId, language, client = db) =>
  (
    await client.query(
      `SELECT id, objective_id, question_type, question_text, options, correct_answer, image, option_images
       FROM question_pool
       WHERE assessment_id = $1 AND language = $2 AND status = 'active' AND question_type = ANY($3)`,
      [assessmentId, language, POOL_TYPES]
    )
  ).rows;

const insertQuestion = (client, sessionId, participantId, idx, q) =>
  client.query(
    `INSERT INTO live_questions (session_id, participant_id, idx, pool_question_id, question_type, question_text, options, correct_answer, objective_id,
                                 image, option_images)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      sessionId,
      participantId,
      idx,
      q.pool_question_id ?? q.id ?? null,
      q.question_type,
      q.question_text,
      q.options ? JSON.stringify(q.options) : null,
      JSON.stringify(decodeStoredValue(q.correct_answer)),
      q.objective_id ?? null,
      q.image ? JSON.stringify(q.image) : null,
      q.option_images ? JSON.stringify(q.option_images) : null,
    ]
  );

const QUICK_PROMPT = ({ topic, count, language }) => `You write quick classroom check questions.
Write ${count} questions about: ${topic}
LANGUAGE: ${language} (write every question and option natively in this language)
Mix "multiple_choice" (exactly 4 options, one correct) and "true_false" questions; mostly multiple choice.
Return ONLY a JSON array of objects: {"question_type", "question_text", "options" (array, MCQ only), "correct_answer" (the correct option text, or true/false)}.`;

/** A quick AI-generated set (validated with the same rules as the exam pool). */
export const generateQuickSet = async ({ topic, count, language, userId }) => {
  const text = await generateContent(QUICK_PROMPT({ topic, count, language }), {
    purpose: "live_quick_set",
    userId,
    temperature: 0.6,
    maxOutputTokens: 4000,
  });
  let raw;
  try {
    const cleaned = String(text).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    raw = JSON.parse(cleaned.slice(cleaned.indexOf("["), cleaned.lastIndexOf("]") + 1));
  } catch {
    raw = [];
  }
  const valid = [];
  const seen = new Set();
  for (const item of Array.isArray(raw) ? raw : []) {
    const type = item?.question_type === "true_false" ? "true_false" : "multiple_choice";
    const checked = validateQuestion(item, { question_type: type, language, num_options: Array.isArray(item?.options) ? item.options.length : 4 });
    if (!checked.ok) continue;
    const key = normalizeText(checked.question.question_text);
    if (seen.has(key)) continue;
    seen.add(key);
    valid.push({ ...checked.question, question_type: type });
    if (valid.length === count) break;
  }
  if (!valid.length) throw bad("LIVE_QUICK_SET_FAILED", "The AI could not write usable questions for this topic. Try a clearer topic.", 422);
  return valid;
};

/**
 * Create a session from an assessment's question bank or a quick AI set.
 * input: { title, source, assessmentId, topic, language, count, pacing, questionMode,
 *          secondsPerQuestion, timeLimitMinutes, settings }
 */
export const createSessionService = async (user, input = {}) => {
  const source = input.source === "ai" ? "ai" : "bank";
  const language = LANGUAGES.includes(input.language) ? input.language : "en";
  const pacing = input.pacing === "student" ? "student" : "teacher";
  const questionMode = input.questionMode === "unique" ? "unique" : "same";
  const count = intIn(input.count, 1, LIVE_LIMITS.maxQuestions, 10);
  const seconds = intIn(input.secondsPerQuestion, 5, 600, 30);
  const timeLimit = pacing === "student" ? intIn(input.timeLimitMinutes, 1, 240, Math.max(1, Math.ceil((count * seconds * 1.5) / 60))) : null;
  const settings = normalizeSettings(input.settings);
  let title = String(input.title || "").trim().slice(0, 200);

  let assessment = null;
  let shared = [];
  if (source === "bank") {
    assessment = await requireAssessmentAccess(input.assessmentId, user);
    const bank = await bankQuestions(assessment.id, language);
    if (!bank.length) throw bad("LIVE_NO_QUESTIONS", "This assessment has no questions in that language yet. Publish it in that language first.", 409);
    if (questionMode === "same") shared = spreadPick(bank, count);
    title ||= assessment.title;
  } else {
    if (questionMode === "unique") throw bad("INVALID_LIVE_SETTINGS", "Unique questions per student need an assessment's question bank.");
    const topic = String(input.topic || "").trim().slice(0, 500);
    if (topic.length < 3) throw bad("INVALID_LIVE_SETTINGS", "Describe the topic for the AI questions.");
    shared = await generateQuickSet({ topic, count, language, userId: user.id });
    title ||= topic.slice(0, 200);
  }
  const questionCount = questionMode === "same" ? shared.length : count;

  return withTransaction(async (client) => {
    let session;
    for (let tries = 0; !session; tries++) {
      try {
        await client.query("SAVEPOINT code");
        session = (
          await client.query(
            `INSERT INTO live_sessions (code, instructor_id, assessment_id, title, source, language, pacing, question_mode,
                                        question_count, seconds_per_question, time_limit_minutes, settings)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
            [newCode(), user.id, assessment?.id ?? null, title, source, language, pacing, questionMode, questionCount, seconds, timeLimit, settings]
          )
        ).rows[0];
      } catch (error) {
        await client.query("ROLLBACK TO SAVEPOINT code");
        if (error.code !== "23505" || tries > 20) throw error; // join code taken by an open session: draw again
      }
    }
    for (const [idx, q] of shared.entries()) await insertQuestion(client, session.id, null, idx, q);
    return hostView(session.id, client);
  });
};

// ------------------------------------------------------------------ loading

const loadSession = async (sessionId, client = db, { forUpdate = false } = {}) => {
  const id = Number.parseInt(sessionId, 10);
  if (!Number.isInteger(id)) throw bad("LIVE_NOT_FOUND", "Session not found.", 404);
  const { rows } = await client.query(`SELECT * FROM live_sessions WHERE id = $1${forUpdate ? " FOR UPDATE" : ""}`, [id]);
  if (!rows[0]) throw bad("LIVE_NOT_FOUND", "Session not found.", 404);
  return rows[0];
};

export const ownSession = async (sessionId, user, client = db, options) => {
  const session = await loadSession(sessionId, client, options);
  if (session.instructor_id !== user.id && user.role !== "super_admin") throw bad("LIVE_FORBIDDEN", "This is not your session.", 403);
  return session;
};

/** Student-paced sessions end on their own at ends_at. */
const effectiveStatus = (s) => (s.status !== "ended" && s.ends_at && ms(s.ends_at) <= now() ? "ended" : s.status);

/** Teacher-paced phase, with "question" turning into "closed" once the deadline has passed. */
const effectivePhase = (s) => {
  if (s.status === "running" && s.phase === "question" && ms(s.question_deadline) <= now()) return "closed";
  return s.phase;
};

/** Public state, safe for everyone in the room (no questions, no answers). */
export const publicState = (s) => ({
  id: s.id,
  code: s.code,
  title: s.title,
  status: effectiveStatus(s),
  pacing: s.pacing,
  questionMode: s.question_mode,
  language: s.language,
  questionCount: s.question_count,
  secondsPerQuestion: s.seconds_per_question,
  currentIndex: s.current_index,
  phase: s.pacing === "teacher" ? effectivePhase(s) : null,
  questionDeadline: s.question_deadline,
  pausedRemainingMs: s.paused_remaining_ms,
  endsAt: s.ends_at,
  settings: { ...DEFAULT_SETTINGS, ...s.settings },
  serverNow: new Date().toISOString(),
});

const activeParticipants = async (sessionId, client = db) =>
  (await client.query(`SELECT * FROM live_participants WHERE session_id = $1 AND removed_at IS NULL ORDER BY id`, [sessionId])).rows;

const questionFor = async (session, participantId, idx, client = db) => {
  const { rows } = await client.query(
    session.question_mode === "unique"
      ? `SELECT * FROM live_questions WHERE participant_id = $1 AND idx = $2`
      : `SELECT * FROM live_questions WHERE session_id = $1 AND idx = $2 AND participant_id IS NULL`,
    [session.question_mode === "unique" ? participantId : session.id, idx]
  );
  return rows[0] || null;
};

/** What a participant may see of a question: never the answer. */
const questionPublic = (q) =>
  q && {
    index: q.idx,
    type: q.question_type,
    text: q.question_text,
    options: questionOptions(q),
    image: q.image ?? null,
    optionImages: q.option_images ?? null,
  };

const correctAnswerOf = (q) => {
  const value = decodeStoredValue(q.correct_answer);
  if (q.question_type === "multiple_choice") return canonicalOption(value, q.options) ?? value;
  if (q.question_type === "true_false") return value;
  return correctAnswerText(q);
};

// ------------------------------------------------------------------ joining

/** Public lookup by code (before joining). */
export const lookupCodeService = async (code) => {
  const { rows } = await db.query(`SELECT * FROM live_sessions WHERE code = $1 AND status <> 'ended' ORDER BY id DESC LIMIT 1`, [String(code || "").trim()]);
  const s = rows[0];
  if (!s || effectiveStatus(s) === "ended") throw bad("LIVE_CODE_UNKNOWN", "No open session has this code. Check the code with your teacher.", 404);
  return { title: s.title, status: effectiveStatus(s), language: s.language, pacing: s.pacing, anonymousNames: s.settings?.anonymousNames === true };
};

const cleanNickname = (raw) =>
  String(raw || "")
    .normalize("NFC")
    .replace(/[\p{C}<>]/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, LIVE_LIMITS.nicknameMax);

/** "Ali" taken -> "Ali 2", "Ali 3"... (case-insensitive, among active participants). */
const uniqueNickname = async (client, sessionId, wanted) => {
  const { rows } = await client.query(`SELECT lower(nickname) AS n FROM live_participants WHERE session_id = $1 AND removed_at IS NULL`, [sessionId]);
  const taken = new Set(rows.map((r) => r.n));
  if (!taken.has(wanted.toLowerCase())) return wanted;
  for (let i = 2; ; i++) {
    const candidate = `${wanted.slice(0, LIVE_LIMITS.nicknameMax - String(i).length - 1)} ${i}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
};

/** Unique mode: this participant's own questions from the bank. */
const assignOwnQuestions = async (client, session, participantId) => {
  const bank = await bankQuestions(session.assessment_id, session.language, client);
  const picked = spreadPick(bank, session.question_count);
  // A small bank is reused rather than leaving a participant without questions.
  for (let i = 0; picked.length < session.question_count && bank.length; i++) picked.push(bank[i % bank.length]);
  for (const [idx, q] of picked.entries()) await insertQuestion(client, session.id, participantId, idx, q);
};

/**
 * Join by code. A logged-in user joins with their account (and rejoins as the same
 * participant); anyone else joins as a guest with a nickname.
 * Returns { token, participant, session }.
 */
export const joinService = async ({ code, nickname, user = null }) => {
  const result = await withTransaction(async (client) => {
    const { rows } = await client.query(`SELECT * FROM live_sessions WHERE code = $1 AND status <> 'ended' ORDER BY id DESC LIMIT 1 FOR UPDATE`, [
      String(code || "").trim(),
    ]);
    const session = rows[0];
    if (!session || effectiveStatus(session) === "ended") throw bad("LIVE_CODE_UNKNOWN", "No open session has this code. Check the code with your teacher.", 404);

    if (user) {
      const existing = (await client.query(`SELECT * FROM live_participants WHERE session_id = $1 AND user_id = $2`, [session.id, user.id])).rows[0];
      if (existing?.removed_at) throw bad("LIVE_REMOVED", "The teacher removed you from this session.", 403);
      if (existing) return { session, participant: existing };
    }

    const count = Number((await client.query(`SELECT count(*) FROM live_participants WHERE session_id = $1 AND removed_at IS NULL`, [session.id])).rows[0].count);
    const max = Number(session.settings?.maxParticipants) || LIVE_LIMITS.defaultMaxParticipants;
    if (count >= max) throw bad("LIVE_FULL", `This session is full (${max} participants).`, 409);

    let wanted;
    if (session.settings?.anonymousNames) wanted = `Student ${count + 1}`;
    else wanted = cleanNickname(user ? user.name : nickname);
    if (!wanted) throw bad("NICKNAME_REQUIRED", "Enter a nickname to join.");
    const name = await uniqueNickname(client, session.id, wanted);

    const teams = teamCount(session.settings);
    const team = teams ? await pickTeam(client, session.id, teams) : null;
    const participant = (
      await client.query(
        `INSERT INTO live_participants (session_id, user_id, nickname, current_index, team)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [session.id, user?.id ?? null, name, 0, team]
      )
    ).rows[0];
    if (session.question_mode === "unique") await assignOwnQuestions(client, session, participant.id);
    return { session, participant };
  });
  liveEvents.changed(result.session.id, "join");
  return {
    token: signParticipantToken(result.session.id, result.participant.id),
    participant: { id: result.participant.id, nickname: result.participant.nickname, guest: !result.participant.user_id },
    session: publicState(result.session),
  };
};

export const loadParticipant = async ({ sessionId, participantId }, client = db, { forUpdate = false } = {}) => {
  const { rows } = await client.query(`SELECT * FROM live_participants WHERE id = $1 AND session_id = $2${forUpdate ? " FOR UPDATE" : ""}`, [
    participantId,
    sessionId,
  ]);
  const p = rows[0];
  if (!p) throw bad("LIVE_TOKEN_INVALID", "Your place in this session has expired. Join again with the code.", 401);
  if (p.removed_at) throw bad("LIVE_REMOVED", "The teacher removed you from this session.", 403);
  return p;
};

// -------------------------------------------------------- participant view

/** Student-paced: this participant's deadline for their current question. */
const personalDeadline = (session, p) => {
  if (!p.question_started_at) return null;
  const own = ms(p.question_started_at) + session.seconds_per_question * 1000;
  return new Date(Math.min(own, ms(session.ends_at) || own)).toISOString();
};

const answerRow = async (participantId, idx, client = db) =>
  (await client.query(`SELECT * FROM live_answers WHERE participant_id = $1 AND idx = $2`, [participantId, idx])).rows[0] || null;

const myTotals = async (participantId, client = db) =>
  (
    await client.query(
      `SELECT count(*)::int AS answered, count(*) FILTER (WHERE is_correct)::int AS correct, COALESCE(sum(points), 0)::int AS points
       FROM live_answers WHERE participant_id = $1`,
      [participantId]
    )
  ).rows[0];

/** Top 5 by points (game mode, between questions). */
export const leaderboard = async (sessionId, client = db, limit = 5) =>
  (
    await client.query(
      `SELECT p.id, p.nickname, p.team, p.score AS points
       FROM live_participants p WHERE p.session_id = $1 AND p.removed_at IS NULL
       ORDER BY p.score DESC, p.id LIMIT $2`,
      [sessionId, limit]
    )
  ).rows;

/** Team race standings from one aggregate query (cheap enough for every participant refresh). */
const teamProgress = async (session, client = db) => {
  const { rows } = await client.query(
    `SELECT p.team, p.id, p.score AS points,
            (SELECT count(*)::int FROM live_answers a WHERE a.participant_id = p.id AND a.is_correct) AS correct
     FROM live_participants p WHERE p.session_id = $1 AND p.removed_at IS NULL AND p.team IS NOT NULL`,
    [session.id]
  );
  return teamStandings(session.settings, rows, session.question_count);
};

/**
 * Everything one participant needs to render their screen. Answers appear only
 * after reveal (teacher-paced) or after they answered (student-paced).
 */
export const participantStateService = async (token) => {
  const ids = verifyParticipantToken(token);
  let session = await loadSession(ids.sessionId);
  let p = await loadParticipant(ids);
  await db.query(`UPDATE live_participants SET last_seen_at = NOW() WHERE id = $1`, [p.id]);
  const status = effectiveStatus(session);
  const base = {
    session: publicState(session),
    me: { id: p.id, nickname: p.nickname, team: p.team, guest: !p.user_id, ...(await myTotals(p.id)) },
    question: null,
    deadline: null,
    myAnswer: null,
    reveal: null,
    finished: false,
    poll: await openPollFor(session.id, p.id),
    teams: teamCount(session.settings) ? await teamProgress(session) : [],
  };
  const game = session.settings?.game === true;

  if (status === "ended" || status === "lobby") {
    if (status === "ended" && game) base.leaderboard = await leaderboard(session.id);
    return base;
  }

  let idx;
  if (session.pacing === "teacher") {
    idx = session.current_index;
    if (idx < 0) return base;
  } else {
    if (p.finished_at || p.current_index >= session.question_count) return { ...base, finished: true };
    idx = p.current_index;
    if (!p.question_started_at && status === "running") {
      // The participant's own timer starts when they first see the question.
      p = (await db.query(`UPDATE live_participants SET question_started_at = NOW() WHERE id = $1 AND question_started_at IS NULL RETURNING *`, [p.id])).rows[0] || p;
      session = await loadSession(ids.sessionId);
    }
  }

  const q = await questionFor(session, p.id, idx);
  const answer = await answerRow(p.id, idx);
  const phase = effectivePhase(session);
  const revealed = session.pacing === "teacher" ? phase === "reveal" : Boolean(answer) || ms(personalDeadline(session, p)) <= now();
  return {
    ...base,
    question: questionPublic(q),
    deadline: session.pacing === "teacher" ? session.question_deadline : personalDeadline(session, p),
    myAnswer: answer ? { answer: answer.answer, ...(revealed ? { correct: answer.is_correct, points: answer.points } : {}) } : null,
    reveal: revealed && q ? { correctAnswer: correctAnswerOf(q) } : null,
    ...(game && session.pacing === "teacher" && phase === "reveal" && session.settings?.showLeaderboard !== false
      ? { leaderboard: await leaderboard(session.id) }
      : {}),
  };
};

/** Submit an answer for the participant's current question (one answer per question, final). */
export const answerService = async (token, { index, answer }) => {
  const ids = verifyParticipantToken(token);
  const outcome = await withTransaction(async (client) => {
    const session = await loadSession(ids.sessionId, client);
    const p = await loadParticipant(ids, client, { forUpdate: true });
    if (effectiveStatus(session) !== "running") throw bad("LIVE_NOT_ACCEPTING", "Answers are not open right now.", 409);

    const idx = session.pacing === "teacher" ? session.current_index : p.current_index;
    if (Number(index) !== idx) throw bad("LIVE_WRONG_QUESTION", "This question is no longer open.", 409);
    let startedAt;
    let deadline;
    if (session.pacing === "teacher") {
      if (session.phase !== "question") throw bad("LIVE_NOT_ACCEPTING", "Answers are not open right now.", 409);
      startedAt = ms(session.question_started_at);
      deadline = ms(session.question_deadline);
    } else {
      startedAt = ms(p.question_started_at) ?? now();
      deadline = ms(personalDeadline(session, p)) ?? now() + session.seconds_per_question * 1000;
    }
    if (now() > deadline + LIVE_LIMITS.graceMs) throw bad("LIVE_TIME_UP", "Time is up for this question.", 409);
    if (!isAnswered(answer)) throw bad("LIVE_EMPTY_ANSWER", "Choose or type an answer first.");
    if (await answerRow(p.id, idx, client)) throw bad("LIVE_ALREADY_ANSWERED", "You already answered this question.", 409);

    const q = await questionFor(session, p.id, idx, client);
    const correct = isAnswerCorrect(q, answer);
    const responseMs = Math.max(0, Math.min(now() - startedAt, session.seconds_per_question * 1000));
    const streak = correct ? p.streak + 1 : 0;
    const points = computePoints({ correct, responseMs, durationMs: session.seconds_per_question * 1000, streak });
    const canonical = canonicalStudentAnswer(q, answer);
    const stored = ["fill_blank", "matching"].includes(q.question_type) ? JSON.parse(canonical) : q.question_type === "multiple_choice" ? canonical : answer;
    await client.query(
      `INSERT INTO live_answers (session_id, participant_id, live_question_id, idx, answer, is_correct, response_ms, points)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [session.id, p.id, q.id, idx, JSON.stringify(stored), correct, responseMs, points]
    );
    await client.query(`UPDATE live_participants SET score = score + $2, streak = $3, last_seen_at = NOW() WHERE id = $1`, [p.id, points, streak]);

    // Teacher-paced: close the question as soon as everyone has answered.
    let closed = false;
    if (session.pacing === "teacher") {
      const { rows } = await client.query(
        `SELECT count(*)::int AS waiting FROM live_participants p
         WHERE p.session_id = $1 AND p.removed_at IS NULL
           AND NOT EXISTS (SELECT 1 FROM live_answers a WHERE a.participant_id = p.id AND a.idx = $2)`,
        [session.id, idx]
      );
      if (rows[0].waiting === 0) {
        await client.query(`UPDATE live_sessions SET phase = 'closed', updated_at = NOW() WHERE id = $1 AND phase = 'question'`, [session.id]);
        closed = true;
      }
    }
    return { sessionId: session.id, pacing: session.pacing, correct, points, q, closed };
  });
  liveEvents.changed(outcome.sessionId, outcome.closed ? "closed" : "answer");
  return {
    accepted: true,
    // Student-paced participants see their result right away; teacher-paced only at reveal.
    ...(outcome.pacing === "student" ? { correct: outcome.correct, points: outcome.points, correctAnswer: correctAnswerOf(outcome.q) } : {}),
  };
};

/** Student-paced: move on to the next question (after answering or when its time is up). */
export const nextQuestionService = async (token) => {
  const ids = verifyParticipantToken(token);
  const sessionId = await withTransaction(async (client) => {
    const session = await loadSession(ids.sessionId, client);
    if (session.pacing !== "student") throw bad("LIVE_TEACHER_PACED", "Your teacher moves the class to the next question.", 409);
    if (effectiveStatus(session) !== "running") throw bad("LIVE_NOT_ACCEPTING", "The session is not running.", 409);
    const p = await loadParticipant(ids, client, { forUpdate: true });
    const answered = await answerRow(p.id, p.current_index, client);
    const timeUp = ms(personalDeadline(session, p)) <= now();
    if (!answered && !timeUp) throw bad("LIVE_ANSWER_FIRST", "Answer this question first.", 409);
    const next = p.current_index + 1;
    await client.query(
      `UPDATE live_participants SET current_index = $2, question_started_at = NULL, finished_at = $3, streak = CASE WHEN $4 THEN streak ELSE 0 END WHERE id = $1`,
      [p.id, next, next >= session.question_count ? new Date() : null, Boolean(answered)]
    );
    return session.id;
  });
  liveEvents.changed(sessionId, "progress");
  return participantStateService(signParticipantToken(ids.sessionId, ids.participantId));
};

// ------------------------------------------------------------ host control

/** Teacher actions: start, next, pause, resume, reveal, end. */
export const controlService = async (sessionId, user, action) => {
  const updated = await withTransaction(async (client) => {
    const s = await ownSession(sessionId, user, client, { forUpdate: true });
    const status = effectiveStatus(s);
    const seconds = s.seconds_per_question;
    const set = async (sql, params = []) =>
      (await client.query(`UPDATE live_sessions SET ${sql}, updated_at = NOW() WHERE id = $1 RETURNING *`, [s.id, ...params])).rows[0];
    const openQuestion = (index) =>
      set(`status = 'running', current_index = $2, phase = 'question', question_started_at = NOW(),
           question_deadline = NOW() + make_interval(secs => $3), paused_remaining_ms = NULL`, [index, seconds]);
    const invalid = () => bad("LIVE_INVALID_ACTION", `"${action}" is not possible right now.`, 409);
    if (status === "ended") throw bad("LIVE_ENDED", "This session has ended.", 409);

    switch (action) {
      case "start":
        if (status !== "lobby") throw invalid();
        if (s.pacing === "student") {
          return set(`status = 'running', started_at = NOW(), ends_at = NOW() + make_interval(mins => $2)`, [s.time_limit_minutes]);
        }
        await set(`started_at = NOW()`);
        return openQuestion(0);
      case "next": {
        if (s.pacing !== "teacher" || status !== "running") throw invalid();
        // A missed question breaks the streak.
        await client.query(
          `UPDATE live_participants p SET streak = 0 WHERE p.session_id = $1 AND p.removed_at IS NULL
             AND NOT EXISTS (SELECT 1 FROM live_answers a WHERE a.participant_id = p.id AND a.idx = $2)`,
          [s.id, s.current_index]
        );
        const next = s.current_index + 1;
        if (next >= s.question_count) return set(`status = 'ended', phase = 'waiting', ended_at = NOW()`);
        return openQuestion(next);
      }
      case "reveal":
        if (s.pacing !== "teacher" || status !== "running" || !["question", "closed"].includes(effectivePhase(s))) throw invalid();
        return set(`phase = 'reveal'`);
      case "pause": {
        if (s.pacing !== "teacher" || status !== "running" || effectivePhase(s) !== "question") throw invalid();
        return set(`status = 'paused', paused_remaining_ms = $2`, [Math.max(0, ms(s.question_deadline) - now())]);
      }
      case "resume":
        if (status !== "paused") throw invalid();
        return set(`status = 'running', question_deadline = NOW() + make_interval(secs => $2::double precision / 1000), paused_remaining_ms = NULL`, [
          s.paused_remaining_ms || 0,
        ]);
      case "end":
        return set(`status = 'ended', phase = 'waiting', ended_at = NOW()`);
      default:
        throw bad("LIVE_INVALID_ACTION", "Unknown action.");
    }
  });
  liveEvents.changed(updated.id, action);
  return hostView(updated.id);
};

export const removeParticipantService = async (sessionId, user, participantId) => {
  const s = await ownSession(sessionId, user);
  const { rows } = await db.query(`UPDATE live_participants SET removed_at = NOW() WHERE id = $1 AND session_id = $2 AND removed_at IS NULL RETURNING id`, [
    participantId,
    s.id,
  ]);
  if (!rows[0]) throw bad("LIVE_PARTICIPANT_NOT_FOUND", "Participant not found.", 404);
  liveEvents.removed(s.id, rows[0].id);
  liveEvents.changed(s.id, "remove");
  return hostView(s.id);
};

// --------------------------------------------------------------- host view

const STRUGGLE = { minAnswers: 2, maxAccuracy: 0.5 };

/** Per-question stats and the teacher's full view, from the database. */
export const hostView = async (sessionId, client = db) => {
  const s = await loadSession(sessionId, client);
  const participants = await activeParticipants(s.id, client);
  const { rows: answers } = await client.query(
    `SELECT a.participant_id, a.idx, a.answer, a.is_correct, a.points, a.response_ms FROM live_answers a WHERE a.session_id = $1`,
    [s.id]
  );
  const { rows: shared } = await client.query(`SELECT * FROM live_questions WHERE session_id = $1 AND participant_id IS NULL ORDER BY idx`, [s.id]);
  const active = new Set(participants.map((p) => p.id));
  const mine = answers.filter((a) => active.has(a.participant_id));

  const perQuestion = Array.from({ length: s.question_count }, (_, idx) => {
    const list = mine.filter((a) => a.idx === idx);
    const q = shared.find((x) => x.idx === idx);
    const distribution = {};
    for (const a of list) {
      const key = typeof a.answer === "string" ? a.answer : JSON.stringify(a.answer);
      distribution[key] = (distribution[key] || 0) + 1;
    }
    return {
      index: idx,
      answered: list.length,
      correct: list.filter((a) => a.is_correct).length,
      percentCorrect: list.length ? Math.round((100 * list.filter((a) => a.is_correct).length) / list.length) : null,
      averageMs: list.length ? Math.round(list.reduce((sum, a) => sum + a.response_ms, 0) / list.length) : null,
      distribution,
      question: q ? { ...questionPublic(q), correctAnswer: correctAnswerOf(q) } : null,
    };
  });

  const people = participants.map((p) => {
    const list = mine.filter((a) => a.participant_id === p.id).sort((a, b) => a.idx - b.idx);
    const correct = list.filter((a) => a.is_correct).length;
    const lastTwoWrong = list.length >= 2 && list.slice(-2).every((a) => !a.is_correct);
    const accuracy = list.length ? correct / list.length : null;
    return {
      id: p.id,
      nickname: p.nickname,
      guest: !p.user_id,
      team: p.team,
      points: p.score,
      answered: list.length,
      correct,
      accuracy: accuracy === null ? null : Math.round(accuracy * 100),
      currentIndex: s.pacing === "student" ? p.current_index : s.current_index,
      answeredCurrent: list.some((a) => a.idx === (s.pacing === "student" ? p.current_index : s.current_index)),
      finished: Boolean(p.finished_at),
      struggling: list.length >= STRUGGLE.minAnswers && (accuracy <= STRUGGLE.maxAccuracy || lastTwoWrong),
      lastSeenAt: p.last_seen_at,
    };
  });

  return {
    session: { ...publicState(s), assessmentId: s.assessment_id, source: s.source, timeLimitMinutes: s.time_limit_minutes, createdAt: s.created_at, endedAt: s.ended_at },
    teams: teamStandings(s.settings, people, s.question_count),
    polls: await pollsForHost(s.id, client),
    participants: people,
    perQuestion,
    current: s.pacing === "teacher" && s.current_index >= 0 ? perQuestion[s.current_index] : null,
    leaderboard: people
      .slice()
      .sort((a, b) => b.points - a.points)
      .slice(0, 5)
      .map(({ id, nickname, team, points }) => ({ id, nickname, team, points })),
  };
};

export const getHostViewService = async (sessionId, user) => {
  await ownSession(sessionId, user);
  return hostView(sessionId);
};

export const listSessionsService = async (user) =>
  (
    await db.query(
      `SELECT s.id, s.code, s.title, s.status, s.pacing, s.question_mode, s.language, s.question_count, s.created_at, s.ended_at,
              s.ends_at, s.assessment_id,
              (SELECT count(*)::int FROM live_participants p WHERE p.session_id = s.id AND p.removed_at IS NULL) AS participants,
              (SELECT round(100.0 * count(*) FILTER (WHERE a.is_correct) / NULLIF(count(*), 0))::int FROM live_answers a WHERE a.session_id = s.id) AS percent_correct
       FROM live_sessions s WHERE s.instructor_id = $1 ORDER BY s.created_at DESC LIMIT 100`,
      [user.id]
    )
  ).rows.map((r) => ({ ...r, status: effectiveStatus(r) }));

const csvCell = (value) => {
  const text = value === null || value === undefined ? "" : typeof value === "string" ? value : JSON.stringify(value);
  // Leading = + - @ would run as a formula in Excel.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** CSV: one row per participant and question. */
export const exportCsvService = async (sessionId, user) => {
  const s = await ownSession(sessionId, user);
  const { rows } = await db.query(
    `SELECT p.nickname, (p.user_id IS NULL) AS guest, p.team, q.idx, q.question_text, a.answer, a.is_correct, a.response_ms, a.points
     FROM live_participants p
     CROSS JOIN generate_series(0, $2 - 1) AS g(idx)
     LEFT JOIN live_questions q ON q.session_id = p.session_id AND q.idx = g.idx AND (q.participant_id IS NULL OR q.participant_id = p.id)
     LEFT JOIN live_answers a ON a.participant_id = p.id AND a.idx = g.idx
     WHERE p.session_id = $1 AND p.removed_at IS NULL
     ORDER BY p.nickname, g.idx`,
    [s.id, s.question_count]
  );
  const header = ["participant", "guest", "team", "question", "question_text", "answer", "correct", "response_seconds", "points"];
  const lines = rows.map((r) =>
    [r.nickname, r.guest ? "yes" : "no", r.team, r.idx + 1, r.question_text, r.answer, r.is_correct === null ? "" : r.is_correct ? "yes" : "no", r.response_ms === null ? "" : (r.response_ms / 1000).toFixed(1), r.points ?? ""]
      .map(csvCell)
      .join(",")
  );
  // Byte-order mark so Excel opens Urdu/Arabic names as UTF-8.
  const bom = String.fromCharCode(0xfeff);
  return { filename: `live-session-${s.code}-${s.id}.csv`, csv: `${bom}${[header.join(","), ...lines].join("\n")}\n` };
};

/** Sessions that need a timer after a restart (running teacher-paced questions, student-paced end times). */
export const openTimers = async () =>
  (
    await db.query(
      `SELECT id, pacing, question_deadline, ends_at FROM live_sessions
       WHERE status = 'running' AND ((pacing = 'teacher' AND phase = 'question') OR pacing = 'student')`
    )
  ).rows;

/** Mark student-paced sessions whose time ran out as ended. */
export const endExpiredSessions = async () => {
  const { rows } = await db.query(
    `UPDATE live_sessions SET status = 'ended', ended_at = ends_at, updated_at = NOW()
     WHERE status IN ('running', 'paused') AND ends_at IS NOT NULL AND ends_at <= NOW() RETURNING id`
  );
  for (const r of rows) liveEvents.changed(r.id, "end");
  return rows.length;
};

export { publicState as livePublicState };
