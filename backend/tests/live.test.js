import { createServer } from "http";
import request from "supertest";
import { io as connect } from "socket.io-client";
import app from "../app.js";
import { queueAdapter } from "../jobs/queue.js";
import { liveEvents } from "../services/live/liveEvents.js";
import { attachRealtime, closeRealtime } from "../services/live/realtime.js";
import { computePoints } from "../services/live/live.service.js";
import { pool, resetDatabase, createUser, auth, installFakes } from "./helpers.js";

let instructor;
let events;
const realEvents = { ...liveEvents };

beforeEach(async () => {
  await resetDatabase();
  installFakes();
  queueAdapter.mode = "inline";
  instructor = await createUser({ role: "instructor", name: "Teacher" });
  events = [];
  liveEvents.changed = (id, kind) => events.push(kind);
  liveEvents.removed = () => events.push("removed");
});

afterAll(async () => {
  Object.assign(liveEvents, realEvents);
  await pool.end();
});

const LESSON = Array.from({ length: 40 }, (_, i) => `Fact ${i}: plants make sugar from light and water in their leaves.`).join(" ");
const MCQ = { question_type: "multiple_choice", question_count: 4, duration_per_question: 60, num_options: 4, positive_marks: 1, negative_marks: 0 };

const publishedAssessment = async () => {
  const res = await request(app)
    .post("/api/assessments")
    .set("Authorization", auth(instructor))
    .field("title", "Plants")
    .field("prompt", "Photosynthesis")
    .field("question_blocks", JSON.stringify([MCQ]))
    .attach("files", Buffer.from(LESSON), { filename: "lesson.txt", contentType: "text/plain" });
  const id = res.body.data.id;
  await request(app).post(`/api/assessments/${id}/publish`).set("Authorization", auth(instructor)).send({ languages: ["en"] });
  return id;
};

const host = (user = instructor) => ({
  create: (body) => request(app).post("/api/live/sessions").set("Authorization", auth(user)).send(body),
  view: (id) => request(app).get(`/api/live/sessions/${id}`).set("Authorization", auth(user)),
  control: (id, action) => request(app).post(`/api/live/sessions/${id}/control`).set("Authorization", auth(user)).send({ action }),
  remove: (id, pid) => request(app).delete(`/api/live/sessions/${id}/participants/${pid}`).set("Authorization", auth(user)),
  csv: (id) => request(app).get(`/api/live/sessions/${id}/export.csv`).set("Authorization", auth(user)),
});
const join = (code, nickname, user) => {
  const req = request(app).post("/api/live/join").send({ code, nickname });
  return user ? req.set("Authorization", auth(user)) : req;
};
const me = (token) => ({
  state: () => request(app).get("/api/live/me").set("X-Live-Token", token),
  answer: (index, answer) => request(app).post("/api/live/me/answer").set("X-Live-Token", token).send({ index, answer }),
  next: () => request(app).post("/api/live/me/next").set("X-Live-Token", token),
});
const correctOf = async (sessionId, idx, participantId = null) => {
  const { rows } = await pool.query(
    `SELECT question_type, options, correct_answer FROM live_questions WHERE session_id = $1 AND idx = $2 AND participant_id IS NOT DISTINCT FROM $3`,
    [sessionId, idx, participantId]
  );
  const q = rows[0];
  if (q.question_type === "multiple_choice") {
    const { canonicalOption } = await import("../utils/grading.js");
    return canonicalOption(q.correct_answer, q.options);
  }
  return q.correct_answer;
};
const wrongOf = async (sessionId, idx) => {
  const { rows } = await pool.query(`SELECT options, correct_answer FROM live_questions WHERE session_id = $1 AND idx = $2 AND participant_id IS NULL`, [sessionId, idx]);
  const right = await correctOf(sessionId, idx);
  return rows[0].options.map((o) => String(o).replace(/^[A-D]\.\s*/, "")).find((o) => o !== right);
};

describe("creating sessions", () => {
  test("from a question bank: a 6-digit code and a fixed snapshot of questions", async () => {
    const assessmentId = await publishedAssessment();
    const res = await host().create({ source: "bank", assessmentId, language: "en", count: 3, secondsPerQuestion: 20 });
    expect(res.status).toBe(201);
    const { session } = res.body.data;
    expect(session.code).toMatch(/^\d{6}$/);
    expect(session).toMatchObject({ status: "lobby", pacing: "teacher", questionMode: "same", questionCount: 3 });
    expect((await pool.query("SELECT count(*)::int AS n FROM live_questions WHERE session_id = $1", [session.id])).rows[0].n).toBe(3);
  });

  test("from a quick AI set: only questions that pass validation are used", async () => {
    const res = await host().create({ source: "ai", topic: "Capitals and arithmetic", language: "en", count: 5 });
    expect(res.status).toBe(201);
    expect(res.body.data.session.questionCount).toBe(3); // the fake model returns 3 valid questions
  });

  test("invalid combinations and other instructors' assessments are refused", async () => {
    const assessmentId = await publishedAssessment();
    expect((await host().create({ source: "ai", topic: "Plants", questionMode: "unique" })).status).toBe(400);
    expect((await host().create({ source: "bank", assessmentId, language: "ur" })).status).toBe(409); // not published in Urdu
    const other = await createUser({ role: "instructor" });
    expect((await host(other).create({ source: "bank", assessmentId })).status).toBe(403);
    expect((await host().create({ source: "bank", assessmentId, count: 99 })).status).toBe(400);
  });
});

describe("joining", () => {
  test("guests join with a nickname; duplicates get a number; a signed-in user rejoins as the same participant", async () => {
    const { session } = (await host().create({ source: "ai", topic: "Capitals", count: 3 })).body.data;
    const a = await join(session.code, "Ali");
    const b = await join(session.code, "ali");
    expect(a.status).toBe(201);
    expect(a.body.data.participant).toMatchObject({ nickname: "Ali", guest: true });
    expect(b.body.data.participant.nickname).toBe("ali 2");
    expect((await join(session.code, "   ")).status).toBe(400);
    expect((await join("000000", "Ali")).status).toBe(404);

    const student = await createUser({ role: "student", name: "Sana" });
    const first = await join(session.code, "ignored", student);
    const again = await join(session.code, "ignored", student);
    expect(first.body.data.participant).toMatchObject({ nickname: "Sana", guest: false });
    expect(again.body.data.participant.id).toBe(first.body.data.participant.id);
    expect(events).toContain("join");
  });

  test("a guest's live token never works as a login (no graded exams for guests)", async () => {
    const { session } = (await host().create({ source: "ai", topic: "Capitals", count: 3 })).body.data;
    const { token } = (await join(session.code, "Guest")).body.data;
    expect((await request(app).get("/api/student-analytics/assessments").set("Authorization", `Bearer ${token}`)).status).toBe(401);
    expect((await request(app).get("/api/live/me").set("X-Live-Token", "forged")).status).toBe(401);
  });

  test("the teacher can remove a participant; their token stops working", async () => {
    const { session } = (await host().create({ source: "ai", topic: "Capitals", count: 3 })).body.data;
    const { token, participant } = (await join(session.code, "Troll")).body.data;
    expect((await host().remove(session.id, participant.id)).status).toBe(200);
    expect((await me(token).state()).status).toBe(403);
    expect(events).toContain("removed");
    // The nickname is free again for a new guest.
    expect((await join(session.code, "Troll")).body.data.participant.nickname).toBe("Troll");
    const other = await createUser({ role: "instructor" });
    expect((await host(other).remove(session.id, participant.id)).status).toBe(403);
  });
});

describe("teacher-paced", () => {
  test("answers stay hidden until reveal; the question closes when everyone answered; points and stats", async () => {
    const { session } = (await host().create({ source: "ai", topic: "Capitals", count: 3, secondsPerQuestion: 30, settings: { game: true } })).body.data;
    const ali = (await join(session.code, "Ali")).body.data.token;
    const sara = (await join(session.code, "Sara")).body.data.token;

    let state = (await me(ali).state()).body.data;
    expect(state.session.status).toBe("lobby");
    expect(state.question).toBeNull();

    expect((await host().control(session.id, "start")).status).toBe(200);
    state = (await me(ali).state()).body.data;
    expect(state.question.index).toBe(0);
    expect(state.reveal).toBeNull();
    expect(new Date(state.deadline).getTime()).toBeGreaterThan(Date.now());
    const right = await correctOf(session.id, 0);
    // Nothing in the participant payload gives the answer away before reveal.
    expect(JSON.stringify(state)).not.toMatch(/correctAnswer|correct_answer|is_correct/);

    const answered = await me(ali).answer(0, right);
    expect(answered.status).toBe(200);
    expect(answered.body.data).toEqual({ accepted: true });
    expect((await me(ali).answer(0, right)).status).toBe(409); // one answer per question
    expect((await me(ali).answer(1, right)).status).toBe(409); // not the open question

    expect((await host().view(session.id)).body.data.session.phase).toBe("question");
    await me(sara).answer(0, await wrongOf(session.id, 0));
    const board = (await host().view(session.id)).body.data;
    expect(board.session.phase).toBe("closed"); // everyone answered
    expect(board.current).toMatchObject({ answered: 2, correct: 1, percentCorrect: 50 });
    expect(Object.values(board.current.distribution).reduce((a, b) => a + b, 0)).toBe(2);
    expect(board.current.question.correctAnswer).toBe(right);

    expect((await host().control(session.id, "reveal")).status).toBe(200);
    state = (await me(ali).state()).body.data;
    expect(state.reveal.correctAnswer).toBe(right);
    expect(state.myAnswer.correct).toBe(true);
    expect(state.myAnswer.points).toBeGreaterThanOrEqual(500);
    expect(state.leaderboard[0].nickname).toBe("Ali"); // game mode: top 5 between questions
    expect((await me(sara).state()).body.data.myAnswer.correct).toBe(false);

    await host().control(session.id, "next");
    expect((await me(ali).state()).body.data.question.index).toBe(1);
    await host().control(session.id, "next");
    await host().control(session.id, "next"); // past the last question -> ended
    expect((await host().view(session.id)).body.data.session.status).toBe("ended");
    expect((await me(ali).answer(2, right)).status).toBe(409);
  });

  test("a late joiner lands on the current question", async () => {
    const { session } = (await host().create({ source: "ai", topic: "Capitals", count: 3 })).body.data;
    await join(session.code, "Early");
    await host().control(session.id, "start");
    await host().control(session.id, "next");
    const late = (await join(session.code, "Late")).body.data.token;
    expect((await me(late).state()).body.data.question.index).toBe(1);
  });

  test("the server's deadline decides: late answers are refused; pause keeps the remaining time", async () => {
    const { session } = (await host().create({ source: "ai", topic: "Capitals", count: 3, secondsPerQuestion: 30 })).body.data;
    const token = (await join(session.code, "Slow")).body.data.token;
    await host().control(session.id, "start");

    expect((await host().control(session.id, "pause")).status).toBe(200);
    const paused = (await pool.query("SELECT status, paused_remaining_ms FROM live_sessions WHERE id = $1", [session.id])).rows[0];
    expect(paused.status).toBe("paused");
    expect(paused.paused_remaining_ms).toBeGreaterThan(28000);
    expect((await me(token).answer(0, "x")).status).toBe(409); // paused: no answers
    await host().control(session.id, "resume");
    const resumed = (await pool.query("SELECT question_deadline FROM live_sessions WHERE id = $1", [session.id])).rows[0];
    expect(new Date(resumed.question_deadline).getTime() - Date.now()).toBeGreaterThan(27000);

    await pool.query("UPDATE live_sessions SET question_deadline = NOW() - interval '2 seconds' WHERE id = $1", [session.id]);
    const late = await me(token).answer(0, await correctOf(session.id, 0));
    expect(late.status).toBe(409);
    expect(late.body.code).toBe("LIVE_TIME_UP");
    expect((await host().view(session.id)).body.data.session.phase).toBe("closed");
    expect((await host().control(session.id, "start")).status).toBe(409); // already started
  });
});

describe("student-paced", () => {
  test("each student moves on alone, sees their result after answering, and the time limit ends the session", async () => {
    const { session } = (await host().create({ source: "ai", topic: "Capitals", count: 3, pacing: "student", timeLimitMinutes: 5 })).body.data;
    const token = (await join(session.code, "Solo")).body.data.token;
    await host().control(session.id, "start");

    let state = (await me(token).state()).body.data;
    expect(state.question.index).toBe(0);
    expect(state.reveal).toBeNull();
    expect((await me(token).next()).status).toBe(409); // answer first

    const right = await correctOf(session.id, 0);
    const result = (await me(token).answer(0, right)).body.data;
    expect(result).toMatchObject({ accepted: true, correct: true, correctAnswer: right });
    state = (await me(token).next()).body.data;
    expect(state.question.index).toBe(1);

    await pool.query("UPDATE live_sessions SET ends_at = NOW() - interval '1 second' WHERE id = $1", [session.id]);
    state = (await me(token).state()).body.data;
    expect(state.session.status).toBe("ended");
    expect((await me(token).answer(1, "x")).status).toBe(409);
  });
});

describe("unique questions per student", () => {
  test("each participant gets their own set from the bank", async () => {
    const assessmentId = await publishedAssessment();
    const { session } = (await host().create({ source: "bank", assessmentId, count: 4, questionMode: "unique" })).body.data;
    const a = (await join(session.code, "A")).body.data;
    const b = (await join(session.code, "B")).body.data;
    const setOf = async (pid) =>
      (await pool.query("SELECT pool_question_id FROM live_questions WHERE participant_id = $1 ORDER BY idx", [pid])).rows.map((r) => r.pool_question_id);
    const [setA, setB] = [await setOf(a.participant.id), await setOf(b.participant.id)];
    expect(setA).toHaveLength(4);
    expect(new Set(setA).size).toBe(4); // no repeats within a student
    expect(setA).not.toEqual(setB);

    await host().control(session.id, "start");
    const qa = (await me(a.token).state()).body.data.question;
    const qb = (await me(b.token).state()).body.data.question;
    expect(qa.index).toBe(0);
    expect(qb.index).toBe(0);
    const right = await correctOf(session.id, 0, a.participant.id);
    await me(a.token).answer(0, right);
    expect((await host().view(session.id)).body.data.perQuestion[0]).toMatchObject({ answered: 1, correct: 1 });
  });
});

describe("results", () => {
  test("struggling students are flagged; CSV export has one row per participant and question", async () => {
    const { session } = (await host().create({ source: "ai", topic: "Capitals", count: 3 })).body.data;
    const weak = (await join(session.code, "=cmd|'/c calc'!A1")).body.data.token;
    await host().control(session.id, "start");
    for (let i = 0; i < 2; i++) {
      await me(weak).answer(i, await wrongOf(session.id, i));
      await host().control(session.id, "next");
    }
    const board = (await host().view(session.id)).body.data;
    expect(board.participants[0]).toMatchObject({ answered: 2, correct: 0, accuracy: 0, struggling: true });

    const csv = await host().csv(session.id);
    expect(csv.status).toBe(200);
    const lines = csv.text.trim().split("\n");
    expect(lines).toHaveLength(1 + 3);
    expect(lines[1].startsWith("﻿")).toBe(false);
    expect(lines[1]).toMatch(/^"?'=cmd/); // formula injection neutralised
    const list = await request(app).get("/api/live/sessions").set("Authorization", auth(instructor));
    expect(list.body.data[0]).toMatchObject({ participants: 1, percent_correct: 0 });
  });

  test("scoring: correct answers earn 500-1000 by speed, plus streak bonus; wrong answers 0", () => {
    expect(computePoints({ correct: false, responseMs: 1, durationMs: 1000, streak: 3 })).toBe(0);
    expect(computePoints({ correct: true, responseMs: 0, durationMs: 1000, streak: 1 })).toBe(1000);
    expect(computePoints({ correct: true, responseMs: 1000, durationMs: 1000, streak: 1 })).toBe(500);
    expect(computePoints({ correct: true, responseMs: 500, durationMs: 1000, streak: 3 })).toBe(950);
    expect(computePoints({ correct: true, responseMs: 1000, durationMs: 1000, streak: 20 })).toBe(1000);
  });
});

describe("real-time (Socket.IO)", () => {
  test("participants and the teacher get pushes; state survives because it lives in the database", async () => {
    Object.assign(liveEvents, realEvents);
    const server = createServer(app);
    await attachRealtime(server);
    await new Promise((resolve) => server.listen(0, resolve));
    const url = `http://localhost:${server.address().port}`;
    const sockets = [];
    try {
      const { session } = (await host().create({ source: "ai", topic: "Capitals", count: 3 })).body.data;
      const { token } = (await join(session.code, "Live")).body.data;

      const student = connect(url, { auth: { liveToken: token }, transports: ["websocket"] });
      const teacher = connect(url, { auth: { token: auth(instructor).slice(7) }, transports: ["websocket"] });
      const stranger = connect(url, { auth: { liveToken: "nope" }, transports: ["websocket"], reconnection: false });
      sockets.push(student, teacher, stranger);
      await new Promise((resolve) => stranger.on("connect_error", resolve));

      const studentStates = [];
      student.on("live:state", (s) => studentStates.push(s));
      await new Promise((resolve) => student.on("connect", resolve));
      const watched = await new Promise((resolve) => teacher.emit("live:watch", session.id, resolve));
      expect(watched).toEqual({ ok: true });

      const boardPushed = new Promise((resolve) => teacher.on("live:board", (b) => b.session.status === "running" && resolve(b)));
      const started = new Promise((resolve) => student.on("live:state", (s) => s.kind === "start" && resolve(s)));
      await host().control(session.id, "start");
      const pushed = await started;
      expect(pushed).toMatchObject({ status: "running", currentIndex: 0, phase: "question" });
      expect(JSON.stringify(pushed)).not.toMatch(/correctAnswer|correct_answer|is_correct/);
      expect((await boardPushed).current.question.correctAnswer).toBeTruthy();

      // A teacher cannot watch someone else's session.
      const other = await createUser({ role: "instructor" });
      const intruder = connect(url, { auth: { token: auth(other).slice(7) }, transports: ["websocket"] });
      sockets.push(intruder);
      expect(await new Promise((resolve) => intruder.emit("live:watch", session.id, resolve))).toEqual({ ok: false });

      // "Restart": drop the realtime layer and bring it back; the state is still there.
      student.disconnect();
      await closeRealtime();
      await attachRealtime(server);
      expect((await me(token).state()).body.data.question.index).toBe(0);
    } finally {
      for (const s of sockets) s.close();
      await closeRealtime();
      await new Promise((resolve) => server.close(resolve));
      liveEvents.changed = (id, kind) => events.push(kind);
    }
  });
});
