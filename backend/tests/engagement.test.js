import request from "supertest";
import app from "../app.js";
import { queueAdapter } from "../jobs/queue.js";
import { liveEvents } from "../services/live/liveEvents.js";
import { canonicalOption } from "../utils/grading.js";
import { pool, resetDatabase, createUser, auth, installFakes } from "./helpers.js";

let instructor;
let events;
const realEvents = { ...liveEvents };

beforeEach(async () => {
  await resetDatabase();
  installFakes();
  queueAdapter.mode = "inline";
  instructor = await createUser({ role: "instructor" });
  events = [];
  liveEvents.changed = (id, kind) => events.push(kind);
  liveEvents.removed = () => {};
});

afterAll(async () => {
  Object.assign(liveEvents, realEvents);
  await pool.end();
});

const T = (user = instructor) => ({ Authorization: auth(user) });
const newSession = async (settings = {}) =>
  (await request(app).post("/api/live/sessions").set(T()).send({ source: "ai", topic: "Capitals", count: 3, settings })).body.data.session;
const join = async (code, nickname) => (await request(app).post("/api/live/join").send({ code, nickname })).body.data;
const openPoll = (id, body) => request(app).post(`/api/live/sessions/${id}/polls`).set(T()).send(body);
const respond = (token, pollId, answer) => request(app).post("/api/live/me/poll").set("X-Live-Token", token).send({ pollId, answer });
const board = async (id) => (await request(app).get(`/api/live/sessions/${id}`).set(T())).body.data;
const me = async (token) => (await request(app).get("/api/live/me").set("X-Live-Token", token)).body.data;

describe("quick polls", () => {
  test("single choice: everyone answers once, the tally updates live, names are shown", async () => {
    const s = await newSession();
    const a = await join(s.code, "Ali");
    const b = await join(s.code, "Bina");
    const poll = (await openPoll(s.id, { kind: "single", question: "Which topic next?", options: ["Plants", "Animals"] })).body.data;
    expect(events).toContain("poll");

    const seen = (await me(a.token)).poll;
    expect(seen).toMatchObject({ id: poll.id, kind: "single", options: ["Plants", "Animals"], myAnswer: null });

    expect((await respond(a.token, poll.id, "Plants")).status).toBe(200);
    expect((await respond(a.token, poll.id, "Animals")).status).toBe(409); // one response each
    expect((await respond(b.token, poll.id, "Fish")).status).toBe(400); // not an option
    await respond(b.token, poll.id, "Plants");
    expect(events).toContain("poll_response");
    expect((await me(a.token)).poll.myAnswer).toBe("Plants");
    // Participants never see other people's answers.
    expect(JSON.stringify(await me(a.token))).not.toContain("Bina");

    const result = (await board(s.id)).polls[0];
    expect(result).toMatchObject({ responses: 2, tally: { Plants: 2, Animals: 0 }, status: "open" });
  });

  test("multiple choice and open text; anonymous polls hide names from the teacher", async () => {
    const s = await newSession();
    const a = await join(s.code, "Ali");
    const multi = (await openPoll(s.id, { kind: "multiple", question: "What did we cover?", options: ["Light", "Water", "Soil"] })).body.data;
    await respond(a.token, multi.id, ["Light", "Water", "Light"]);
    expect((await board(s.id)).polls[0].tally).toEqual({ Light: 1, Water: 1, Soil: 0 });

    // Opening a new poll closes the previous one.
    const text = (await openPoll(s.id, { kind: "text", question: "One word for today?", anonymous: true })).body.data;
    expect((await respond(a.token, multi.id, ["Soil"])).status).toBe(409);
    await respond(a.token, text.id, "  Sunlight  ");
    const polls = (await board(s.id)).polls;
    expect(polls[0].status).toBe("closed");
    expect(polls[1].texts).toEqual([{ nickname: null, text: "Sunlight" }]);

    expect((await request(app).post(`/api/live/sessions/${s.id}/polls/${text.id}/close`).set(T())).status).toBe(200);
    expect((await me(a.token)).poll).toBeNull();
  });

  test("invalid polls are refused and only the session's teacher can run them", async () => {
    const s = await newSession();
    expect((await openPoll(s.id, { kind: "single", question: "Q?", options: ["One"] })).status).toBe(400);
    expect((await openPoll(s.id, { kind: "single", question: "Q?", options: ["Same", "same"] })).status).toBe(400);
    expect((await openPoll(s.id, { kind: "text", question: "" })).status).toBe(400);
    expect((await openPoll(s.id, { kind: "quiz" })).status).toBe(400);
    const other = await createUser({ role: "instructor" });
    expect((await request(app).post(`/api/live/sessions/${s.id}/polls`).set(T(other)).send({ kind: "exit_ticket" })).status).toBe(403);
  });
});

describe("exit ticket", () => {
  test("understanding 1-5, one thing learned, one question; the teacher gets a summary", async () => {
    const s = await newSession();
    const a = await join(s.code, "Ali");
    const b = await join(s.code, "Bina");
    const ticket = (await openPoll(s.id, { kind: "exit_ticket" })).body.data;
    expect((await respond(a.token, ticket.id, { understanding: 7, learned: "x" })).status).toBe(400);
    expect((await respond(a.token, ticket.id, { understanding: 4 })).status).toBe(400); // learned is required
    await respond(a.token, ticket.id, { understanding: 4, learned: "Leaves make sugar", question: "Why are leaves green?" });
    await respond(b.token, ticket.id, { understanding: 2, learned: "روشنی ضروری ہے" });
    const summary = (await board(s.id)).polls[0].exitTicket;
    expect(summary.averageUnderstanding).toBe(3);
    expect(summary.distribution).toEqual({ 1: 0, 2: 1, 3: 0, 4: 1, 5: 0 });
    expect(summary.learned.map((l) => l.text)).toEqual(["Leaves make sugar", "روشنی ضروری ہے"]);
    expect(summary.questions).toEqual([{ nickname: "Ali", text: "Why are leaves green?" }]);
  });
});

describe("team race", () => {
  test("participants are balanced over teams; the teacher can move them; correct answers move a team forward", async () => {
    expect((await request(app).post("/api/live/sessions").set(T()).send({ source: "ai", topic: "Capitals", settings: { teams: 7 } })).status).toBe(400);
    const s = await newSession({ teams: 2, game: true });
    const people = [];
    for (const n of ["A", "B", "C", "D", "E"]) people.push(await join(s.code, n));
    let view = await board(s.id);
    expect(view.participants.map((p) => p.team)).toEqual(["1", "2", "1", "2", "1"]);
    expect(view.teams.map((t) => t.members)).toEqual([3, 2]);

    const target = people[4].participant.id;
    const move = await request(app).put(`/api/live/sessions/${s.id}/participants/${target}/team`).set(T()).send({ team: 2 });
    expect(move.status).toBe(200);
    expect(move.body.data.teams.map((t) => t.members)).toEqual([2, 3]);
    expect((await request(app).put(`/api/live/sessions/${s.id}/participants/${target}/team`).set(T()).send({ team: 3 })).status).toBe(400);

    await request(app).post(`/api/live/sessions/${s.id}/control`).set(T()).send({ action: "start" });
    const { rows } = await pool.query("SELECT options, correct_answer, question_type FROM live_questions WHERE session_id = $1 AND idx = 0", [s.id]);
    const right = rows[0].question_type === "multiple_choice" ? canonicalOption(rows[0].correct_answer, rows[0].options) : rows[0].correct_answer;
    await request(app).post("/api/live/me/answer").set("X-Live-Token", people[1].token).send({ index: 0, answer: right }); // team 2
    view = await board(s.id);
    const [team1, team2] = view.teams;
    expect(team1).toMatchObject({ team: "1", correct: 0, progress: 0 });
    expect(team2).toMatchObject({ team: "2", correct: 1, progress: Math.round((100 * 1) / (3 * 3)) });
    const mine = await me(people[1].token);
    expect(mine.teams[1].correct).toBe(1);
    expect(mine.me.team).toBe("2");
  });
});
