import request from "supertest";
import app from "../app.js";
import { mailer } from "../helper/emailService.js";
import { httpClient, resolveEmailProvider, missingEmailSettings, sendWithProvider } from "../helper/emailProviders.js";
import { validateEnv } from "../config/env.js";
import { pool, resetDatabase, installFakes, flushEmails } from "./helpers.js";

const BREVO = { EMAIL_PROVIDER: "brevo", BREVO_API_KEY: "brevo-test-key", EMAIL_FROM: "teacher@example.com", EMAIL_FROM_NAME: "Gradix Pilot" };
const MESSAGE = { to: "student@example.com", subject: "Hello", html: "<p>Hi</p>", text: "Hi" };

let posts;
const realPost = httpClient.post;
beforeEach(async () => {
  await resetDatabase();
  installFakes();
  posts = [];
  httpClient.post = async (url, request) => {
    posts.push({ url, ...request });
    return { messageId: "<m1@brevo>", id: "r1" };
  };
});

afterAll(async () => {
  httpClient.post = realPost;
  await pool.end();
});

describe("email providers", () => {
  test("the provider comes from EMAIL_PROVIDER, otherwise from whichever key is set", () => {
    expect(resolveEmailProvider({ EMAIL_PROVIDER: "Resend", BREVO_API_KEY: "x" })).toBe("resend");
    expect(resolveEmailProvider({ BREVO_API_KEY: "x", EMAIL_USER: "a", EMAIL_PASS: "b" })).toBe("brevo");
    expect(resolveEmailProvider({ RESEND_API_KEY: "x" })).toBe("resend");
    expect(resolveEmailProvider({ EMAIL_USER: "a", EMAIL_PASS: "b" })).toBe("smtp");
    expect(resolveEmailProvider({})).toBeNull();
  });

  test("startup names exactly the settings the chosen provider is missing", () => {
    expect(missingEmailSettings({ EMAIL_PROVIDER: "brevo", BREVO_API_KEY: "x" })).toEqual(["EMAIL_FROM"]);
    expect(missingEmailSettings({ EMAIL_PROVIDER: "smtp" })).toEqual(["EMAIL_USER", "EMAIL_PASS"]);
    expect(missingEmailSettings({ EMAIL_PROVIDER: "pigeon" })[0]).toMatch(/must be one of/);
    expect(missingEmailSettings(BREVO)).toEqual([]);
    // Brevo needs no Gmail settings at all.
    expect(() => validateEnv({ ...process.env, EMAIL_USER: "", EMAIL_PASS: "", ...BREVO })).not.toThrow();
    expect(() => validateEnv({ ...process.env, EMAIL_PROVIDER: "brevo", BREVO_API_KEY: "" })).toThrow(/BREVO_API_KEY/);
  });

  test("Brevo is called over HTTPS with the verified sender, and the key only in a header", async () => {
    const result = await sendWithProvider(MESSAGE, BREVO);
    expect(result).toEqual({ provider: "brevo", id: "<m1@brevo>" });
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(posts[0].headers).toEqual({ "api-key": "brevo-test-key" });
    expect(posts[0].body).toEqual({
      sender: { name: "Gradix Pilot", email: "teacher@example.com" },
      to: [{ email: "student@example.com" }],
      subject: "Hello",
      htmlContent: "<p>Hi</p>",
      textContent: "Hi",
    });
    expect(JSON.stringify(posts[0].body)).not.toContain("brevo-test-key");
  });

  test("Resend is the alternative HTTP provider", async () => {
    const result = await sendWithProvider(MESSAGE, { EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_test", EMAIL_FROM: "no-reply@school.example" });
    expect(result).toEqual({ provider: "resend", id: "r1" });
    expect(posts[0].url).toBe("https://api.resend.com/emails");
    expect(posts[0].headers).toEqual({ authorization: "Bearer re_test" });
    expect(posts[0].body).toMatchObject({ from: "Gradix <no-reply@school.example>", to: ["student@example.com"], subject: "Hello" });
  });

  test("app emails go through the provider; a provider failure never breaks the request", async () => {
    const saved = Object.fromEntries(Object.keys(BREVO).map((k) => [k, process.env[k]]));
    Object.assign(process.env, BREVO);
    mailer.send = async ({ to, subject, html }) => sendWithProvider({ to, subject, html, text: html.replace(/<[^>]*>/g, "") });
    try {
      httpClient.post = async (url, req) => {
        posts.push({ url, ...req });
        throw new Error("HTTP 401: unauthorized");
      };
      const res = await request(app)
        .post("/api/auth/signup")
        .send({ name: "Mail Fail", email: "mail.fail@test.io", password: "Str0ngPass", captchaToken: "ok" });
      expect(res.status).toBe(201);
      await flushEmails();
      expect(posts.map((p) => p.url)).toEqual(["https://api.brevo.com/v3/smtp/email"]);
      expect(posts[0].body.to).toEqual([{ email: "mail.fail@test.io" }]);
    } finally {
      Object.assign(process.env, saved);
    }
  });
});
