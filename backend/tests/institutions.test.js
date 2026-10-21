import request from "supertest";
import app from "../app.js";
import { pool, resetDatabase, createUser, createAssessment, auth, installFakes, flushEmails, PASSWORD } from "./helpers.js";

let fakes;
let superAdmin;
let admin;
let instructor;

beforeEach(async () => {
  await resetDatabase();
  fakes = installFakes();
  superAdmin = await createUser({ role: "super_admin" });
  admin = await createUser({ role: "admin" });
  instructor = await createUser({ role: "instructor", name: "Teacher" });
});

afterAll(async () => {
  await pool.end();
});

const as = (user) => ({
  get: (path) => request(app).get(path).set("Authorization", auth(user)),
  post: (path, body) => request(app).post(path).set("Authorization", auth(user)).send(body),
  put: (path, body) => request(app).put(path).set("Authorization", auth(user)).send(body),
  del: (path) => request(app).delete(path).set("Authorization", auth(user)),
});
const makeGroup = async (name, members) => {
  const g = (await as(superAdmin).post("/api/groups", { name })).body.data;
  if (members.length) await as(superAdmin).post(`/api/groups/${g.id}/members`, { emails: members.map((m) => m.email) });
  return g;
};
const notificationsOf = async (user) => (await pool.query("SELECT type, data FROM notifications WHERE user_id = $1 ORDER BY id", [user.id])).rows;

describe("groups", () => {
  test("only the super admin creates and manages groups; unknown emails are reported", async () => {
    expect((await as(admin).post("/api/groups", { name: "X" })).status).toBe(403);
    const created = await as(superAdmin).post("/api/groups", { name: "Grade 9" });
    expect(created.status).toBe(201);
    const student = await createUser({ role: "student" });
    const add = await as(superAdmin).post(`/api/groups/${created.body.data.id}/members`, { emails: [student.email, "nobody@test.io"] });
    expect(add.body.data).toEqual({ added: 1, notFound: ["nobody@test.io"] });
    expect((await as(superAdmin).post("/api/groups", { name: "grade 9" })).status).toBe(409);
    expect((await as(superAdmin).put(`/api/groups/${created.body.data.id}`, { name: "Grade 9A" })).body.data.name).toBe("Grade 9A");
  });

  test("admins and instructors see only their own groups", async () => {
    const mine = await makeGroup("Mine", [admin, instructor]);
    await makeGroup("Theirs", []);
    const list = await as(admin).get("/api/groups");
    expect(list.body.data.map((g) => g.name)).toEqual(["Mine"]);
    expect((await as(instructor).get("/api/groups")).body.data.map((g) => g.id)).toEqual([mine.id]);
    expect((await as(superAdmin).get("/api/groups")).body.data).toHaveLength(2);
    const other = (await as(superAdmin).get("/api/groups")).body.data.find((g) => g.name === "Theirs");
    expect((await as(admin).get(`/api/groups/${other.id}/members`)).status).toBe(404);
  });
});

describe("admin scope", () => {
  test("an admin sees and manages only users who share a group", async () => {
    const inside = await createUser({ role: "student", name: "Inside" });
    const outside = await createUser({ role: "student", name: "Outside" });
    await makeGroup("Class", [admin, inside]);

    const users = await as(admin).get("/api/auth/users");
    const names = users.body.users.map((u) => u.name);
    expect(names).toContain("Inside");
    expect(names).not.toContain("Outside");

    expect((await as(admin).put("/api/auth/change-role", { userId: outside.id, newRole: "instructor" })).status).toBe(403);
    expect((await as(admin).put("/api/auth/change-role", { userId: inside.id, newRole: "instructor" })).status).toBe(200);
    // Still only student <-> instructor, even in their own group.
    expect((await as(admin).put("/api/auth/change-role", { userId: inside.id, newRole: "admin" })).status).toBe(403);
  });

  test("the super admin can set any role for anyone", async () => {
    const student = await createUser({ role: "student" });
    expect((await as(superAdmin).put("/api/auth/change-role", { userId: student.id, newRole: "admin" })).status).toBe(200);
  });
});

describe("enroll a whole group", () => {
  test("enrolls every student of the group once, emails and notifies each", async () => {
    const s1 = await createUser({ role: "student" });
    const s2 = await createUser({ role: "student" });
    const group = await makeGroup("Class", [instructor, s1, s2]);
    const assessment = await createAssessment(instructor);
    await pool.query("INSERT INTO enrollments (assessment_id, student_id) VALUES ($1, $2)", [assessment.id, s1.id]);

    const res = await as(instructor).post(`/api/assessments/${assessment.id}/enroll-group`, { groupId: group.id });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ enrolled: 1, alreadyEnrolled: 1 });
    await flushEmails();
    expect(fakes.sentEmails.filter((m) => m.to === s2.email)).toHaveLength(1);
    expect(fakes.sentEmails.filter((m) => m.to === s1.email)).toHaveLength(0);
    expect(await notificationsOf(s2)).toEqual([{ type: "enrolled", data: { assessmentId: assessment.id, title: "Sample" } }]);
  });

  test("an instructor cannot enroll a group they do not belong to", async () => {
    const group = await makeGroup("Other", [await createUser({ role: "student" })]);
    const assessment = await createAssessment(instructor);
    expect((await as(instructor).post(`/api/assessments/${assessment.id}/enroll-group`, { groupId: group.id })).status).toBe(404);
  });
});

describe("notifications", () => {
  test("role change and password change create notifications; the bell lists and marks them read", async () => {
    const student = await createUser({ role: "student" });
    await as(superAdmin).put("/api/auth/change-role", { userId: student.id, newRole: "instructor" });
    await as({ ...student, role: "instructor" }).post("/api/auth/change-password", { currentPassword: PASSWORD, newPassword: "NewPassw0rd1" });

    const bell = await as(student).get("/api/notifications");
    expect(bell.body.data.unread).toBe(2);
    expect(bell.body.data.items.map((n) => n.type)).toEqual(["password_changed", "role_changed"]);
    expect(bell.body.data.items[1].data).toEqual({ oldRole: "student", newRole: "instructor" });

    const first = bell.body.data.items[0].id;
    expect((await as(student).post(`/api/notifications/${first}/read`)).status).toBe(200);
    expect((await as(student).get("/api/notifications")).body.data.unread).toBe(1);
    await as(student).post("/api/notifications/read-all");
    expect((await as(student).get("/api/notifications")).body.data.unread).toBe(0);
    // Someone else's notification cannot be touched.
    expect((await as(admin).post(`/api/notifications/${first}/read`)).status).toBe(404);
  });
});

describe("account deletion", () => {
  test("anonymises the account, keeps results, emails the person and blocks sign-in", async () => {
    const student = await createUser({ role: "student", name: "Sara" });
    const assessment = await createAssessment(instructor, undefined, { status: "published" });
    await pool.query("INSERT INTO enrollments (assessment_id, student_id) VALUES ($1, $2)", [assessment.id, student.id]);
    await pool.query(
      `INSERT INTO assessment_attempts (student_id, assessment_id, status, score, completed_at) VALUES ($1, $2, 'completed', 3, NOW())`,
      [student.id, assessment.id]
    );

    const res = await as(superAdmin).del(`/api/auth/users/${student.id}`);
    expect(res.status).toBe(200);
    await flushEmails();
    expect(fakes.sentEmails.some((m) => m.to === student.email && /deleted/i.test(m.subject))).toBe(true);

    const user = (await pool.query("SELECT name, email, password, deleted_at FROM users WHERE id = $1", [student.id])).rows[0];
    expect(user.name).toBe("Deleted user");
    expect(user.email).toBe(`deleted-${student.id}@deleted.invalid`);
    expect(user.password).toBeNull();
    expect(user.deleted_at).not.toBeNull();
    expect((await pool.query("SELECT score FROM assessment_attempts WHERE student_id = $1", [student.id])).rows[0].score).toBe(3);
    expect((await pool.query("SELECT count(*)::int AS n FROM enrollments WHERE student_id = $1", [student.id])).rows[0].n).toBe(0);

    const login = await request(app).post("/api/auth/login").send({ email: student.email, password: PASSWORD, captchaToken: "x" });
    expect(login.status).toBe(401);
    // Old tokens stop working too.
    expect((await as(student).get("/api/notifications")).status).toBe(401);
    // Deleted users disappear from user lists.
    expect((await as(superAdmin).get("/api/auth/users")).body.users.map((u) => u.id)).not.toContain(student.id);
  });
});

describe("lifecycle notifications", () => {
  test("enrolled students hear when the assessment is published and when their results are ready", async () => {
    const { queueAdapter } = await import("../jobs/queue.js");
    queueAdapter.mode = "inline";
    const student = await createUser({ role: "student" });
    await pool.query("UPDATE users SET language_preference = 'ur' WHERE id = $1", [student.id]);
    const created = await request(app)
      .post("/api/assessments")
      .set("Authorization", auth(instructor))
      .field("title", "Plants")
      .field("prompt", "Photosynthesis basics")
      .field("question_blocks", JSON.stringify([{ question_type: "true_false", question_count: 1, duration_per_question: 30, positive_marks: 1, negative_marks: 0 }]));
    const id = created.body.data.id;
    await as(instructor).post(`/api/assessments/${id}/enroll`, { email: student.email });
    await as(instructor).post(`/api/assessments/${id}/publish`, { languages: ["en"] });
    await flushEmails();
    expect((await notificationsOf(student)).map((n) => n.type)).toEqual(["enrolled", "published"]);
    expect(fakes.sentEmails.some((m) => m.to === student.email && m.subject.startsWith("امتحان دستیاب ہے"))).toBe(true);

    const start = await as(student).post(`/api/taking/assessments/${id}/start`, { language: "en" });
    const done = await as(student).post(`/api/taking/assessments/${id}/submit`, { attemptId: start.body.data.attemptId });
    expect(done.status).toBe(200);
    // Resubmitting must not notify twice.
    await as(student).post(`/api/taking/assessments/${id}/submit`, { attemptId: start.body.data.attemptId });
    await flushEmails();
    const types = (await notificationsOf(student)).map((n) => n.type);
    expect(types.filter((t) => t === "results_ready")).toHaveLength(1);
    expect(fakes.sentEmails.filter((m) => m.to === student.email && m.subject.startsWith("آپ کے نتائج"))).toHaveLength(1);
  });
});
