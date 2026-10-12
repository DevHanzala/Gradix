import request from "supertest";
import app from "../app.js";
import { pool, resetDatabase, createUser, auth, installFakes, flushEmails, PASSWORD } from "./helpers.js";

let fakes;

beforeEach(async () => {
  await resetDatabase();
  fakes = installFakes();
});

afterAll(async () => {
  await pool.end();
});

describe("google-auth", () => {
  test("a missing token is rejected", async () => {
    const res = await request(app).post("/api/auth/google-auth").send({});
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_GOOGLE_TOKEN");
  });

  test("a fake token is rejected even if the body names a real account", async () => {
    const victim = await createUser({ role: "super_admin" });
    const res = await request(app)
      .post("/api/auth/google-auth")
      .send({ idToken: "forged", email: victim.email, uid: "anything", name: "Attacker" });
    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  test("identity comes from the verified token, never from the body", async () => {
    await createUser({ role: "super_admin", email: "boss@test.io" });
    fakes.verifiedTokens["good-token"] = { uid: "g-1", email: "new.student@test.io", email_verified: true, name: "New" };

    const res = await request(app)
      .post("/api/auth/google-auth")
      .send({ idToken: "good-token", email: "boss@test.io" });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("new.student@test.io");
    expect(res.body.user.role).toBe("student");
  });

  test("tokens with an unverified email are rejected", async () => {
    fakes.verifiedTokens.unverified = { uid: "g-2", email: "x@test.io", email_verified: false };
    expect((await request(app).post("/api/auth/google-auth").send({ idToken: "unverified" })).status).toBe(401);
  });
});

describe("login", () => {
  const login = (email, password) =>
    request(app).post("/api/auth/login").send({ email, password, captchaToken: "ok" });

  test("unknown email and wrong password give the same generic error", async () => {
    const user = await createUser({ role: "student" });
    const unknown = await login("nobody@test.io", "x");
    const wrong = await login(user.email, "wrong-password");
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.message).toBe(wrong.body.message);
  });

  test("valid credentials return a token; email matching ignores case", async () => {
    const user = await createUser({ role: "student" });
    const res = await login(user.email.toUpperCase(), PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  test("an unverified account must verify first (only revealed with the right password)", async () => {
    const user = await createUser({ role: "student", verified: false });
    const res = await login(user.email, PASSWORD);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("EMAIL_NOT_VERIFIED");
  });

  test("CAPTCHA is required", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "a@b.io", password: "x" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("CAPTCHA_REQUIRED");
  });
});

describe("passwords", () => {
  test("change-password requires authentication", async () => {
    const res = await request(app).post("/api/auth/change-password").send({ currentPassword: PASSWORD, newPassword: "NewPassw0rd1" });
    expect(res.status).toBe(401);
  });

  test("change-password requires the current password and sends an email", async () => {
    const user = await createUser({ role: "student" });
    const change = (body) => request(app).post("/api/auth/change-password").set("Authorization", auth(user)).send(body);

    expect((await change({ currentPassword: "wrong", newPassword: "NewPassw0rd1" })).status).toBe(400);
    expect((await change({ currentPassword: PASSWORD, newPassword: "weak" })).body.code).toBe("WEAK_PASSWORD");
    expect((await change({ currentPassword: PASSWORD, newPassword: "NewPassw0rd1" })).status).toBe(200);

    await flushEmails();
    expect(fakes.sentEmails.some((m) => m.to === user.email && /password was changed/i.test(m.subject))).toBe(true);
    const relogin = await request(app).post("/api/auth/login").send({ email: user.email, password: "NewPassw0rd1", captchaToken: "ok" });
    expect(relogin.status).toBe(200);
  });

  test("forgot-password answers identically for known and unknown emails", async () => {
    const user = await createUser({ role: "student" });
    const known = await request(app).post("/api/auth/forgot-password").send({ email: user.email });
    const unknown = await request(app).post("/api/auth/forgot-password").send({ email: "ghost@test.io" });
    expect(known.status).toBe(200);
    expect(known.body.message).toBe(unknown.body.message);
  });

  test("a reset link works once and sends a confirmation email", async () => {
    const user = await createUser({ role: "student" });
    await request(app).post("/api/auth/forgot-password").send({ email: user.email });
    const { rows } = await pool.query("SELECT reset_token FROM users WHERE id = $1", [user.id]);
    const reset = (body) => request(app).post("/api/auth/reset-password").send(body);

    expect((await reset({ resetId: rows[0].reset_token, newPassword: "Another1Pass" })).status).toBe(200);
    expect((await reset({ resetId: rows[0].reset_token, newPassword: "Another1Pass" })).status).toBe(400);
  });
});

describe("email verification", () => {
  test("tokens expire after 24 hours and cannot be reused; invalid tokens always fail", async () => {
    const user = await createUser({ role: "student", verified: false });
    const verify = (token) => request(app).get(`/api/auth/verify/${token}`);

    await pool.query(
      "UPDATE users SET verification_token = 'expired', verification_token_expires = NOW() - INTERVAL '1 minute' WHERE id = $1",
      [user.id]
    );
    expect((await verify("expired")).status).toBe(400);
    expect((await verify("made-up")).status).toBe(400);

    await pool.query(
      "UPDATE users SET verification_token = 'fresh', verification_token_expires = NOW() + INTERVAL '1 hour' WHERE id = $1",
      [user.id]
    );
    expect((await verify("fresh")).status).toBe(200);
    expect((await verify("fresh")).status).toBe(400);
  });

  test("signup sends a verification email and does not log the user in", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ name: "New Person", email: "New.Person@Test.io", password: "Str0ngPass", captchaToken: "ok" });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeUndefined();
    await flushEmails();
    expect(fakes.sentEmails[0].to).toBe("new.person@test.io");
  });
});

describe("hardening", () => {
  test("the debug logs endpoint is gone and security headers are set", async () => {
    expect((await request(app).get("/api/logs")).status).toBe(404);
    const health = await request(app).get("/api/health");
    expect(health.headers["x-content-type-options"]).toBe("nosniff");
    expect(health.headers["x-powered-by"]).toBeUndefined();
  });

  test("error responses never include stack traces", async () => {
    const res = await request(app).get("/api/assessments/not-a-number").set("Authorization", auth(await createUser({ role: "instructor" })));
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/stack|node_modules/);
  });
});
