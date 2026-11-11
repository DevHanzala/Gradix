import request from "supertest";
import app from "../app.js";
import { queueAdapter } from "../jobs/queue.js";
import { liveEvents } from "../services/live/liveEvents.js";
import { PLANS } from "../config/plans.js";
import { pool, resetDatabase, createUser, auth, installFakes, enroll } from "./helpers.js";

let instructor;
const realEvents = { ...liveEvents };
beforeEach(async () => {
  await resetDatabase();
  installFakes();
  queueAdapter.mode = "inline";
  liveEvents.changed = () => {};
  instructor = await createUser({ role: "instructor" });
});
afterAll(async () => {
  Object.assign(liveEvents, realEvents);
  await pool.end();
});

const LESSON = Array.from({ length: 40 }, (_, i) => `Fact ${i}: plants make sugar from light and water in their leaves.`).join(" ");
const TF = { question_type: "true_false", question_count: 3, duration_per_question: 60, positive_marks: 1, negative_marks: 0 };
const create = (user = instructor) =>
  request(app)
    .post("/api/assessments")
    .set("Authorization", auth(user))
    .field("title", "Plants")
    .field("prompt", "Photosynthesis")
    .field("question_blocks", JSON.stringify([TF]))
    .attach("files", Buffer.from(LESSON), { filename: "lesson.txt", contentType: "text/plain" });

describe("plans", () => {
  test("the price list is public; instructors see their own plan and usage", async () => {
    const list = (await request(app).get("/api/plans")).body.data;
    expect(list.map((p) => p.id)).toEqual(["free", "pro", "institution"]);
    expect(list[1].pricePkr).toBe(PLANS.pro.pricePkr);
    await create();
    const me = (await request(app).get("/api/plans/me").set("Authorization", auth(instructor))).body.data;
    expect(me).toMatchObject({ plan: "free", usage: { assessmentsPerMonth: 1 } });
  });

  test("a Free user at the monthly limit gets a clear PLAN_LIMIT_REACHED error; a group's plan lifts it", async () => {
    await pool.query(
      `INSERT INTO assessments (title, instructor_id) SELECT 'Old ' || g, $1 FROM generate_series(1, $2) g`,
      [instructor.id, PLANS.free.limits.assessmentsPerMonth]
    );
    const blocked = await create();
    expect(blocked.status).toBe(403);
    expect(blocked.body).toMatchObject({ code: "PLAN_LIMIT_REACHED", details: { metric: "assessmentsPerMonth", plan: "free" } });

    const admin = await createUser({ role: "super_admin" });
    const A = { Authorization: auth(admin) };
    const group = (await request(app).post("/api/groups").set(A).send({ name: "Pilot School" })).body.data;
    await pool.query("INSERT INTO group_memberships (group_id, user_id) VALUES ($1, $2)", [group.id, instructor.id]);
    expect((await request(app).put(`/api/plans/groups/${group.id}`).set(A).send({ plan: "gold" })).status).toBe(400);
    expect((await request(app).put(`/api/plans/groups/${group.id}`).set(A).send({ plan: "pro" })).body.data.plan).toBe("pro");
    expect((await create()).status).toBe(201);

    const accounts = (await request(app).get("/api/plans/accounts").set(A)).body.data;
    expect(accounts.find((a) => a.id === instructor.id)).toMatchObject({ ownPlan: "free", plan: "pro" });
    expect((await request(app).put(`/api/plans/users/${instructor.id}`).set(A).send({ plan: "institution" })).body.data.plan).toBe("institution");
    expect((await request(app).get("/api/plans/accounts").set({ Authorization: auth(instructor) })).status).toBe(403);
  });

  test("student limit on enrollment; a running exam is never stopped by limits", async () => {
    const id = (await create()).body.data.id;
    await request(app).post(`/api/assessments/${id}/publish`).set("Authorization", auth(instructor)).send({ languages: ["en"] });
    const running = await createUser({ role: "student" });
    await enroll({ id }, running);
    const started = await request(app).post(`/api/taking/assessments/${id}/start`).set("Authorization", auth(running)).send({ language: "en" });
    expect(started.status).toBe(200);

    // Fill the plan's student limit with other assessments' students.
    const other = (await pool.query(`INSERT INTO assessments (title, instructor_id) VALUES ('Other', $1) RETURNING id`, [instructor.id])).rows[0].id;
    await pool.query(
      `WITH s AS (INSERT INTO users (name, email, password, role, verified, provider)
                  SELECT 'S' || g, 's' || g || '@limit.io', 'x', 'student', TRUE, 'manual' FROM generate_series(1, $2) g RETURNING id)
       INSERT INTO enrollments (assessment_id, student_id) SELECT $1, id FROM s`,
      [other, PLANS.free.limits.students]
    );
    const newcomer = await createUser({ role: "student", email: "new@limit.io" });
    const refused = await request(app).post(`/api/assessments/${id}/enroll`).set("Authorization", auth(instructor)).send({ email: newcomer.email });
    expect(refused.body.code).toBe("PLAN_LIMIT_REACHED");

    // The student already in the exam continues normally.
    const q = started.body.data.question;
    const saved = await request(app).put(`/api/taking/attempts/${started.body.data.attemptId}/answers/${q.id}`).set("Authorization", auth(running)).send({ answer: true });
    expect(saved.status).toBe(200);
  });

  test("live sessions take their size from the plan", async () => {
    const { session } = (await request(app).post("/api/live/sessions").set("Authorization", auth(instructor)).send({ source: "ai", topic: "Capitals", count: 3 })).body.data;
    const row = (await pool.query("SELECT settings FROM live_sessions WHERE id = $1", [session.id])).rows[0];
    expect(row.settings.maxParticipants).toBe(PLANS.free.limits.liveSessionSize);
  });
});
