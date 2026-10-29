import request from "supertest";
import app from "../app.js";
import { queueAdapter } from "../jobs/queue.js";
import { shuffleOptions, normalizeExamSettings, assertWithinWindow } from "../services/examControls.js";
import { pool, resetDatabase, createUser, auth, installFakes, enroll } from "./helpers.js";

let instructor;
beforeEach(async () => {
  await resetDatabase();
  installFakes();
  queueAdapter.mode = "inline";
  instructor = await createUser({ role: "instructor" });
});
afterAll(async () => {
  await pool.end();
});

const LESSON = Array.from({ length: 40 }, (_, i) => `Fact ${i}: plants make sugar from light and water in their leaves.`).join(" ");
const MCQ = { question_type: "multiple_choice", question_count: 4, duration_per_question: 60, num_options: 4, positive_marks: 1, negative_marks: 0 };
const T = () => ({ Authorization: auth(instructor) });
const published = async () => {
  const res = await request(app)
    .post("/api/assessments")
    .set(T())
    .field("title", "Plants")
    .field("prompt", "Photosynthesis")
    .field("question_blocks", JSON.stringify([MCQ]))
    .attach("files", Buffer.from(LESSON), { filename: "lesson.txt", contentType: "text/plain" });
  const id = res.body.data.id;
  await request(app).post(`/api/assessments/${id}/publish`).set(T()).send({ languages: ["en"] });
  return id;
};
const settings = (id, body) => request(app).put(`/api/assessments/${id}/exam-settings`).set(T()).send(body);
const student = async (id) => {
  const s = await createUser({ role: "student" });
  await enroll({ id }, s);
  return s;
};
const start = (id, s, body = {}) => request(app).post(`/api/taking/assessments/${id}/start`).set("Authorization", auth(s)).send({ language: "en", ...body });
const event = (s, attemptId, kind) => request(app).post(`/api/taking/attempts/${attemptId}/events`).set("Authorization", auth(s)).send({ kind, questionIndex: 0 });

describe("exam settings", () => {
  test("validated and saved; only the assessment's instructor can change them", async () => {
    const id = await published();
    expect((await settings(id, { proctoring: "camera" })).status).toBe(400);
    expect((await settings(id, { windowStart: "2030-01-02T10:00:00Z", windowEnd: "2030-01-01T10:00:00Z" })).status).toBe(400);
    expect((await settings(id, { timeZone: "Mars/Olympus" })).status).toBe(400);
    const ok = await settings(id, { proctoring: "auto_submit", maxViolations: 2, timeZone: "Asia/Karachi" });
    expect(ok.body.data).toMatchObject({ proctoring: "auto_submit", maxViolations: 2, shuffleOptions: true });
    const other = await createUser({ role: "instructor" });
    expect((await request(app).put(`/api/assessments/${id}/exam-settings`).set("Authorization", auth(other)).send({ proctoring: "off" })).status).toBe(403);
    expect(normalizeExamSettings(undefined)).toBeNull();
  });
});

describe("exam window", () => {
  test("an exam outside its window cannot be started; late join closes after N minutes", async () => {
    const id = await published();
    const s = await student(id);
    const hour = 3600 * 1000;
    await settings(id, { windowStart: new Date(Date.now() + hour).toISOString() });
    expect((await start(id, s)).body.code).toBe("EXAM_NOT_OPEN");
    await settings(id, { windowStart: new Date(Date.now() - 2 * hour).toISOString(), windowEnd: new Date(Date.now() - hour).toISOString() });
    expect((await start(id, s)).body.code).toBe("EXAM_CLOSED");
    await settings(id, { windowStart: new Date(Date.now() - 30 * 60000).toISOString(), windowEnd: new Date(Date.now() + hour).toISOString(), lateJoinMinutes: 15 });
    expect((await start(id, s)).body.code).toBe("EXAM_LATE_JOIN_CLOSED");
    await settings(id, { lateJoinMinutes: 45 });
    expect((await start(id, s)).status).toBe(200);
    expect(() => assertWithinWindow({ windowStart: null, windowEnd: null, lateJoinMinutes: 5 })).not.toThrow();
  });
});

describe("proctoring", () => {
  test("the student must accept; events are logged with timestamps; auto-submit at the limit; instructor sees the timeline", async () => {
    const id = await published();
    await settings(id, { proctoring: "auto_submit", maxViolations: 2 });
    const s = await student(id);
    const state = (await request(app).get(`/api/taking/assessments/${id}/attempt`).set("Authorization", auth(s))).body.data;
    expect(state.examControls).toMatchObject({ proctoring: "auto_submit", maxViolations: 2, timeZone: "Asia/Karachi" });
    expect((await start(id, s)).body.code).toBe("PROCTORING_CONSENT_REQUIRED");
    const started = (await start(id, s, { acceptProctoring: true })).body.data;

    expect((await event(s, started.attemptId, "screenshot")).status).toBe(400);
    expect((await event(s, started.attemptId, "tab_hidden")).body.data).toMatchObject({ violations: 1, autoSubmitted: false });
    expect((await event(s, started.attemptId, "copy")).body.data).toMatchObject({ violations: 2, autoSubmitted: true });
    const attempt = (await pool.query("SELECT status, auto_submitted_reason, proctoring_accepted_at FROM assessment_attempts WHERE id = $1", [started.attemptId])).rows[0];
    expect(attempt).toMatchObject({ status: "completed", auto_submitted_reason: "proctoring" });
    expect(attempt.proctoring_accepted_at).not.toBeNull();

    const timeline = (await request(app).get(`/api/assessments/${id}/attempts/${started.attemptId}/integrity`).set(T())).body.data;
    expect(timeline.events.map((e) => e.kind)).toEqual(["tab_hidden", "copy"]);
    expect(new Date(timeline.events[0].occurred_at).getTime()).toBeGreaterThan(0);
    const list = (await request(app).get(`/api/instructor-analytics/assessment/${id}/students`).set(T())).body;
    expect(JSON.stringify(list)).toContain('"violation_count":2');

    // Another student cannot report events for this attempt.
    const other = await student(id);
    expect((await event(other, started.attemptId, "copy")).status).toBe(404);
  });

  test("with proctoring off nothing is recorded", async () => {
    const id = await published();
    const s = await student(id);
    const started = (await start(id, s)).body.data;
    expect((await event(s, started.attemptId, "tab_hidden")).body.data).toMatchObject({ violations: 0, level: "off" });
    expect((await pool.query("SELECT count(*)::int AS n FROM attempt_events")).rows[0].n).toBe(0);
  });
});

describe("accommodations and shuffling", () => {
  test("extra time multiplies the server's time per question for that student only", async () => {
    const id = await published();
    const slow = await student(id);
    const normal = await student(id);
    expect((await request(app).put(`/api/assessments/${id}/enrollments/${slow.id}/extra-time`).set(T()).send({ extraTime: 4 })).status).toBe(400);
    expect((await request(app).put(`/api/assessments/${id}/enrollments/${slow.id}/extra-time`).set(T()).send({ extraTime: 1.5 })).body.data).toEqual({ studentId: slow.id, extraTime: 1.5 });
    const a = (await start(id, slow)).body.data;
    const b = (await start(id, normal)).body.data;
    expect(a.question.duration_per_question).toBe(90);
    expect(b.question.duration_per_question).toBe(60);
  });

  test("MCQ options are shuffled per student, images stay with their option, grading is unaffected", () => {
    const q = { question_type: "multiple_choice", options: ["A1", "B2", "C3", "D4"], option_images: [{ key: "a" }, null, { key: "c" }, null], correct_answer: "C3" };
    const seen = new Set();
    for (let i = 0; i < 40; i++) {
      const s = shuffleOptions(q);
      expect([...s.options].sort()).toEqual(q.options);
      s.options.forEach((o, j) => expect(s.option_images[j]).toEqual(q.option_images[q.options.indexOf(o)]));
      seen.add(s.options.join());
    }
    expect(seen.size).toBeGreaterThan(1);
    expect(shuffleOptions({ question_type: "true_false", options: null })).toEqual({ question_type: "true_false", options: null });
  });
});
