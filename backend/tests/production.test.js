import request from "supertest";
import app from "../app.js";
import { queueAdapter } from "../jobs/queue.js";
import { createBackup, restoreBackup, tablesInOrder } from "../services/backup.js";
import { scrubEvent } from "../services/monitoring.js";
import { pdfRenderer, pdfQueueLength } from "../helper/pdfRenderer.js";
import { estimateTokenCount } from "../helper/embeddingGenerator.js";
import { reembedPoolJob } from "../jobs/definitions/resources.js";
import { jobsRunInApi } from "../jobs/runner.js";
import { pool, resetDatabase, createUser, auth, installFakes, enroll, fakeTokenCount } from "./helpers.js";

beforeEach(async () => {
  await resetDatabase();
  installFakes();
  queueAdapter.mode = "inline";
});
afterAll(async () => {
  await pool.end();
});

describe("health and logging", () => {
  test("/api/health reports database, storage and job queue, quickly", async () => {
    const started = Date.now();
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, status: "ok", checks: { database: { status: "ok" }, storage: { status: "ok", driver: "local" }, jobs: { status: "ok" } } });
    expect(res.body.memoryMb).toBeGreaterThan(0);
    expect(Date.now() - started).toBeLessThan(3000);
  });

  test("every response carries a request ID; a given ID is kept", async () => {
    const res = await request(app).get("/api/plans");
    expect(res.headers["x-request-id"]).toMatch(/^[\w-]{8,}$/);
    expect((await request(app).get("/api/plans").set("X-Request-Id", "trace-12345678")).headers["x-request-id"]).toBe("trace-12345678");
    expect((await request(app).get("/api/plans").set("X-Request-Id", "bad id!")).headers["x-request-id"]).not.toBe("bad id!");
  });

  test("Sentry events never carry request bodies, user data or query strings", () => {
    const event = scrubEvent({
      request: { method: "PUT", url: "https://api/attempts/1/answers/2?token=abc", data: { answer: "Paris" }, headers: { authorization: "x" }, cookies: "c" },
      user: { email: "student@school.pk", ip_address: "1.2.3.4" },
      extra: { body: "secret" },
      contexts: { request: {} },
    });
    expect(event).toEqual({ request: { method: "PUT", url: "https://api/attempts/1/answers/2" }, contexts: {} });
  });

  test("the worker runs in the API process by default (RUN_WORKER_IN_PROCESS)", () => {
    const saved = { a: process.env.RUN_WORKER_IN_PROCESS, b: process.env.JOBS_IN_API };
    delete process.env.RUN_WORKER_IN_PROCESS;
    delete process.env.JOBS_IN_API;
    expect(jobsRunInApi()).toBe(true);
    process.env.RUN_WORKER_IN_PROCESS = "false";
    expect(jobsRunInApi()).toBe(false);
    process.env.RUN_WORKER_IN_PROCESS = saved.a ?? "";
    if (saved.a === undefined) delete process.env.RUN_WORKER_IN_PROCESS;
    if (saved.b !== undefined) process.env.JOBS_IN_API = saved.b;
  });
});

describe("memory-conscious helpers", () => {
  test("PDFs render one at a time", async () => {
    let running = 0;
    let peak = 0;
    const realRender = pdfRenderer.render;
    // Exercise the real queue with a slow fake renderer behind it.
    const { default: puppeteer } = await import("puppeteer");
    const realLaunch = puppeteer.launch;
    puppeteer.launch = async () => ({
      newPage: async () => ({
        setContent: async () => {
          running += 1;
          peak = Math.max(peak, running);
          await new Promise((r) => setTimeout(r, 30));
        },
        evaluateHandle: async () => {},
        pdf: async () => {
          running -= 1;
          return Buffer.from("%PDF");
        },
      }),
      close: async () => {},
    });
    try {
      const jobs = [1, 2, 3].map(() => realRender("<p>x</p>"));
      expect(pdfQueueLength()).toBe(3);
      await Promise.all(jobs);
      expect(peak).toBe(1);
    } finally {
      puppeteer.launch = realLaunch;
    }
  });

  test("token estimate (Gemini embedding mode) stays close to the tokenizer ratio", () => {
    const text = "Plants make sugar from light and water in their green leaves.";
    expect(estimateTokenCount(text)).toBe(fakeTokenCount(text));
  });

  test("pool questions made with another embedding model are re-embedded", async () => {
    const instructor = await createUser({ role: "instructor" });
    const { rows } = await pool.query(`INSERT INTO assessments (title, instructor_id) VALUES ('A', $1) RETURNING id`, [instructor.id]);
    const vector = `[${new Array(384).fill(0).map((_, i) => (i === 0 ? 1 : 0)).join(",")}]`;
    await pool.query(
      `INSERT INTO question_pool (assessment_id, question_type, difficulty, language, question_text, correct_answer, stem_hash, embedding, embedding_model)
       VALUES ($1, 'true_false', 3, 'en', 'The sky is blue.', 'true', 'h1', $2::vector, 'some-old-model')`,
      [rows[0].id, vector]
    );
    expect(await reembedPoolJob()).toEqual({ reembedded: 1 });
    const after = (await pool.query(`SELECT embedding_model, embedding::text AS e FROM question_pool`)).rows[0];
    expect(after.embedding_model).not.toBe("some-old-model");
    expect(after.e).not.toBe(vector);
  });
});

describe("backup and restore", () => {
  test("a backup goes to storage and restores every row into an empty database", async () => {
    const instructor = await createUser({ role: "instructor", name: "استاد" });
    const student = await createUser({ role: "student" });
    const { rows } = await pool.query(
      `INSERT INTO assessments (title, instructor_id, exam_settings) VALUES ('اردو امتحان', $1, $2) RETURNING id`,
      [instructor.id, { proctoring: "warn" }]
    );
    await enroll({ id: rows[0].id }, student);
    await pool.query(`INSERT INTO learning_reports (attempt_id, assessment_id, student_id, language, pdf) SELECT NULL, $1, $2, 'ur', $3 WHERE FALSE`, [rows[0].id, student.id, Buffer.from("x")]);

    const order = await tablesInOrder();
    expect(order.indexOf("users")).toBeLessThan(order.indexOf("assessments"));
    expect(order.indexOf("assessments")).toBeLessThan(order.indexOf("enrollments"));

    const backup = await createBackup();
    expect(backup.key).toMatch(/^backups\/gradix-.*\.ndjson\.gz$/);
    expect(backup.rows).toBeGreaterThanOrEqual(4);

    await expect(restoreBackup(backup.key)).rejects.toThrow(/not empty/);
    await resetDatabase();
    const restored = await restoreBackup(backup.key);
    expect(restored.rows).toBe(backup.rows);
    const back = (await pool.query(`SELECT title, exam_settings FROM assessments`)).rows[0];
    expect(back).toEqual({ title: "اردو امتحان", exam_settings: { proctoring: "warn" } });
    expect((await pool.query(`SELECT name FROM users WHERE role = 'instructor'`)).rows[0].name).toBe("استاد");
    // Sequences moved on: a new row gets a fresh id.
    const fresh = await createUser({ role: "student" });
    expect(fresh.id).toBeGreaterThan(student.id);
    void auth;
  });
});
