import request from "supertest";
import app from "../app.js";
import { pool, resetDatabase, createUser, createAssessment, enroll, auth, installFakes, flushEmails } from "./helpers.js";

let fakes;
let superAdmin;
let admin;
let otherAdmin;
let instructor;
let otherInstructor;
let student;

beforeEach(async () => {
  await resetDatabase();
  fakes = installFakes();
  superAdmin = await createUser({ role: "super_admin" });
  admin = await createUser({ role: "admin" });
  otherAdmin = await createUser({ role: "admin" });
  instructor = await createUser({ role: "instructor" });
  otherInstructor = await createUser({ role: "instructor" });
  student = await createUser({ role: "student" });
});

afterAll(async () => {
  await pool.end();
});

const changeRole = (actor, target, newRole) =>
  request(app).put("/api/auth/change-role").set("Authorization", auth(actor)).send({ userId: target.id, newRole });
const roleOf = async (user) => (await pool.query("SELECT role FROM users WHERE id = $1", [user.id])).rows[0].role;

describe("student hitting instructor and admin routes", () => {
  test.each([
    ["get", "/api/assessments"],
    ["post", "/api/assessments"],
    ["get", "/api/resources"],
    ["get", "/api/resources/all"],
    ["get", "/api/instructor-analytics"],
    ["get", "/api/instructor-analytics/assessments"],
    ["get", "/api/auth/users"],
    ["put", "/api/auth/change-role"],
    ["post", "/api/auth/register-student"],
  ])("%s %s → 403", async (method, url) => {
    const res = await request(app)[method](url).set("Authorization", auth(student));
    expect(res.status).toBe(403);
  });

  test("instructors cannot use the student exam endpoints", async () => {
    const assessment = await createAssessment(instructor);
    const res = await request(app)
      .post(`/api/taking/assessments/${assessment.id}/start`)
      .set("Authorization", auth(instructor))
      .send({});
    expect(res.status).toBe(403);
  });

  test("requests without a token are rejected", async () => {
    expect((await request(app).get("/api/assessments")).status).toBe(401);
  });
});

describe("role changes", () => {
  test("an admin cannot demote the super admin", async () => {
    const res = await changeRole(admin, superAdmin, "student");
    expect(res.status).toBe(403);
    expect(await roleOf(superAdmin)).toBe("super_admin");
  });

  test("an admin cannot change another admin", async () => {
    expect((await changeRole(admin, otherAdmin, "student")).status).toBe(403);
    expect(await roleOf(otherAdmin)).toBe("admin");
  });

  test("an admin cannot grant admin or super admin", async () => {
    expect((await changeRole(admin, student, "admin")).status).toBe(403);
    expect((await changeRole(admin, student, "super_admin")).status).toBe(403);
    expect(await roleOf(student)).toBe("student");
  });

  test("an admin can move users between student and instructor", async () => {
    expect((await changeRole(admin, student, "instructor")).status).toBe(200);
    expect(await roleOf(student)).toBe("instructor");
  });

  test("the super admin can set any role, including instructor, and an email is sent", async () => {
    expect((await changeRole(superAdmin, admin, "instructor")).status).toBe(200);
    expect(await roleOf(admin)).toBe("instructor");
    await flushEmails();
    expect(fakes.sentEmails.some((m) => /role/i.test(m.subject))).toBe(true);
  });

  test("nobody can change their own role", async () => {
    expect((await changeRole(superAdmin, superAdmin, "student")).status).toBe(400);
  });

  test("only the super admin can delete users, and never themselves", async () => {
    const del = (actor, target) => request(app).delete(`/api/auth/users/${target.id}`).set("Authorization", auth(actor));
    expect((await del(admin, student)).status).toBe(403);
    expect((await del(superAdmin, superAdmin)).status).toBe(400);
    expect((await del(superAdmin, student)).status).toBe(200);
  });
});

describe("assessment ownership", () => {
  let assessment;
  beforeEach(async () => {
    assessment = await createAssessment(instructor);
  });

  const editAs = (user, id = assessment.id) =>
    request(app)
      .put(`/api/assessments/${id}`)
      .set("Authorization", auth(user))
      .field("title", "Changed")
      .field("prompt", "Changed prompt");

  test("an instructor cannot read, edit or delete another instructor's assessment", async () => {
    expect((await request(app).get(`/api/assessments/${assessment.id}`).set("Authorization", auth(otherInstructor))).status).toBe(403);
    expect((await editAs(otherInstructor)).status).toBe(403);
    expect((await request(app).delete(`/api/assessments/${assessment.id}`).set("Authorization", auth(otherInstructor))).status).toBe(403);
    const { rows } = await pool.query("SELECT title FROM assessments WHERE id = $1", [assessment.id]);
    expect(rows[0].title).toBe("Sample");
  });

  test("an admin who is not the owner cannot edit it either", async () => {
    expect((await editAs(admin)).status).toBe(403);
  });

  test("the owner can edit before execution but not after", async () => {
    expect((await editAs(instructor)).status).toBe(200);
    await pool.query("UPDATE assessments SET is_executed = TRUE WHERE id = $1", [assessment.id]);
    const locked = await editAs(instructor);
    expect(locked.status).toBe(409);
    expect(locked.body.code).toBe("ASSESSMENT_LOCKED");
    const del = await request(app).delete(`/api/assessments/${assessment.id}`).set("Authorization", auth(instructor));
    expect(del.status).toBe(409);
  });

  test("the super admin can access any assessment", async () => {
    expect((await request(app).get(`/api/assessments/${assessment.id}`).set("Authorization", auth(superAdmin))).status).toBe(200);
  });

  test("enrolling and viewing analytics require ownership", async () => {
    const enrollRes = await request(app)
      .post(`/api/assessments/${assessment.id}/enroll`)
      .set("Authorization", auth(otherInstructor))
      .send({ email: student.email });
    expect(enrollRes.status).toBe(403);

    await enroll(assessment, student);
    const students = await request(app)
      .get(`/api/instructor-analytics/assessment/${assessment.id}/student/${student.id}/questions`)
      .set("Authorization", auth(otherInstructor));
    expect(students.status).toBeGreaterThanOrEqual(400);
  });
});

describe("resource visibility", () => {
  test("/resources/all returns public resources plus the caller's own", async () => {
    await pool.query(
      `INSERT INTO resources (name, content_type, visibility, uploaded_by)
       VALUES ('mine-private', 'file', 'private', $1), ('theirs-private', 'file', 'private', $2), ('theirs-public', 'file', 'public', $2)`,
      [instructor.id, otherInstructor.id]
    );
    const res = await request(app).get("/api/resources/all").set("Authorization", auth(instructor));
    expect(res.body.data.map((r) => r.name).sort()).toEqual(["mine-private", "theirs-public"]);
  });

  test("linking someone else's private resource is refused", async () => {
    const assessment = await createAssessment(instructor);
    const { rows } = await pool.query(
      `INSERT INTO resources (name, content_type, visibility, uploaded_by) VALUES ('secret', 'file', 'private', $1) RETURNING id`,
      [otherInstructor.id]
    );
    const res = await request(app)
      .post(`/api/resources/${rows[0].id}/assessments/${assessment.id}`)
      .set("Authorization", auth(instructor));
    expect(res.status).toBe(403);
  });
});
