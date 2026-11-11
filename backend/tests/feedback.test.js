import request from "supertest";
import app from "../app.js";
import { pool, resetDatabase, createUser, auth, installFakes } from "./helpers.js";

beforeEach(async () => {
  await resetDatabase();
  installFakes();
});
afterAll(async () => {
  await pool.end();
});

describe("feedback and contact", () => {
  test("signed-in feedback and public contact messages are stored for the Super Admin only", async () => {
    const student = await createUser({ role: "student" });
    const sent = await request(app).post("/api/feedback").set("Authorization", auth(student)).send({ message: "The timer is great", page: "/student/dashboard" });
    expect(sent.status).toBe(201);
    expect((await request(app).post("/api/feedback").send({ message: "anonymous feedback" })).status).toBe(401);
    expect((await request(app).post("/api/feedback").send({ kind: "contact", message: "Pricing?", email: "not-an-email" })).status).toBe(400);
    expect((await request(app).post("/api/feedback").send({ kind: "contact", name: "School", email: "head@school.pk", message: "Pricing for 300 students?" })).status).toBe(201);
    expect((await request(app).post("/api/feedback").set("Authorization", auth(student)).send({ message: " " })).status).toBe(400);

    expect((await request(app).get("/api/feedback").set("Authorization", auth(student))).status).toBe(403);
    const admin = await createUser({ role: "super_admin" });
    const list = (await request(app).get("/api/feedback").set("Authorization", auth(admin))).body.data;
    expect(list.map((f) => f.kind).sort()).toEqual(["contact", "feedback"]);
    expect(list.find((f) => f.kind === "feedback")).toMatchObject({ user_role: "student", page: "/student/dashboard", status: "new" });
    const done = await request(app).patch(`/api/feedback/${list[0].id}`).set("Authorization", auth(admin)).send({ status: "done" });
    expect(done.body.data.status).toBe("done");
  });
});
