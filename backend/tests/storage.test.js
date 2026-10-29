import fs from "fs/promises";
import request from "supertest";
import app from "../app.js";
import { queueAdapter } from "../jobs/queue.js";
import { pdfRenderer } from "../helper/pdfRenderer.js";
import { storage, storageAdapter, localDriver, r2Driver, assertKey, contentDisposition, missingStorageSettings } from "../helper/storage.js";
import { migrateStorage } from "../services/storage/migrateStorage.js";
import { pool, resetDatabase, createUser, auth, installFakes, enroll } from "./helpers.js";

const realRender = pdfRenderer.render;
let instructor;

beforeEach(async () => {
  await fs.rm(process.env.STORAGE_LOCAL_DIR, { recursive: true, force: true });
  await resetDatabase();
  installFakes();
  queueAdapter.mode = "inline";
  pdfRenderer.render = async () => Buffer.from("%PDF-1.4 fake report");
  instructor = await createUser({ role: "instructor" });
});

afterAll(async () => {
  pdfRenderer.render = realRender;
  await pool.end();
});

/** GET a signed URL (local links point at this app's /api/files route). */
const fetchSigned = (url) => {
  const u = new URL(url);
  return request(app)
    .get(u.pathname + u.search)
    .buffer(true)
    .parse((r, done) => {
      const chunks = [];
      r.on("data", (c) => chunks.push(c));
      r.on("end", () => done(null, Buffer.concat(chunks)));
    });
};

const LESSON = Array.from({ length: 40 }, (_, i) => `Fact ${i}: plants make sugar from light and water in their leaves.`).join(" ");
const upload = (user, { visibility = "private", filename = "نوٹس.txt" } = {}) =>
  request(app)
    .post("/api/resources")
    .set("Authorization", auth(user))
    .field("visibility", visibility)
    .attach("files", Buffer.from(LESSON), { filename, contentType: "text/plain" });
const uploadedId = (res) => res.body.resources[0].id;

describe("storage layer", () => {
  test("local driver: put, get, list, delete; keys cannot escape the folder", async () => {
    await storage.put("t/one.txt", Buffer.from("1"));
    await storage.put("t/sub/two.txt", Buffer.from("2"));
    expect((await storage.get("t/sub/two.txt")).toString()).toBe("2");
    expect(await storage.list("t/")).toEqual(["t/one.txt", "t/sub/two.txt"]);
    await storage.delete("t/one.txt");
    await expect(storage.get("t/one.txt")).rejects.toMatchObject({ code: "FILE_NOT_FOUND" });
    for (const bad of ["../etc/passwd", "/abs", "a/../../b", "a\\b", ""]) expect(() => assertKey(bad)).toThrow();
  });

  test("signed local links work until they expire and cannot be altered", async () => {
    await storage.put("t/report.pdf", Buffer.from("PDFDATA"));
    const { url, expiresAt } = await storage.signedUrl("t/report.pdf", { filename: "رپورٹ.pdf", contentType: "application/pdf", baseUrl: "http://api.test" });
    expect(new Date(expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(300 * 1000);
    const ok = await fetchSigned(url);
    expect(ok.status).toBe(200);
    expect(ok.body.toString()).toBe("PDFDATA");
    expect(ok.headers["content-type"]).toBe("application/pdf");
    expect(ok.headers["content-disposition"]).toBe(contentDisposition("رپورٹ.pdf"));

    expect((await fetchSigned(url.replace("t/report.pdf", "t/other.pdf"))).status).toBe(403);
    const expired = new URL(url);
    expired.searchParams.set("e", String(Math.floor(Date.now() / 1000) - 1));
    expect((await fetchSigned(expired.toString())).status).toBe(403);
  });

  test("R2 links are presigned S3 URLs with a 5-minute expiry and the download name (no network)", async () => {
    const env = { R2_ACCOUNT_ID: "acc123", R2_ACCESS_KEY_ID: "AKIDTEST", R2_SECRET_ACCESS_KEY: "secret-test", R2_BUCKET: "gradix-files" };
    const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
    Object.assign(process.env, env);
    try {
      const url = new URL(await r2Driver.signedUrl("reports/5/ur.pdf", { expiresIn: 300, filename: "report.pdf", contentType: "application/pdf" }));
      expect(url.origin).toBe("https://acc123.r2.cloudflarestorage.com");
      expect(url.pathname).toBe("/gradix-files/reports/5/ur.pdf");
      expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
      expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
      expect(url.searchParams.get("response-content-disposition")).toContain('filename="report.pdf"');
      expect(url.toString()).not.toContain("secret-test");
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
    expect(missingStorageSettings({ STORAGE_DRIVER: "r2", R2_BUCKET: "b" })).toEqual(["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]);
    expect(
      missingStorageSettings({ STORAGE_DRIVER: "r2", R2_ENDPOINT: "http://localhost:9000", R2_ACCESS_KEY_ID: "a", R2_SECRET_ACCESS_KEY: "b", R2_BUCKET: "c" })
    ).toEqual([]);
    expect(missingStorageSettings({})).toEqual([]);
  });
});

describe("uploaded resources", () => {
  test("the original file is kept and only users allowed to use the resource get a link", async () => {
    const res = await upload(instructor);
    expect(res.status).toBe(201);
    const id = uploadedId(res);
    const row = (await pool.query("SELECT storage_key FROM resources WHERE id = $1", [id])).rows[0];
    expect(row.storage_key).toMatch(new RegExp(`^resources/${id}/[\\w.-]+\\.txt$`));

    const link = await request(app).get(`/api/resources/${id}/file`).set("Authorization", auth(instructor));
    expect(link.status).toBe(200);
    const file = await fetchSigned(link.body.data.url);
    expect(file.status).toBe(200);
    expect(file.body.toString()).toBe(LESSON);
    expect(file.headers["content-disposition"]).toContain(encodeURIComponent("نوٹس.txt"));

    const other = await createUser({ role: "instructor" });
    expect((await request(app).get(`/api/resources/${id}/file`).set("Authorization", auth(other))).status).toBe(403);
    const student = await createUser({ role: "student" });
    expect((await request(app).get(`/api/resources/${id}/file`).set("Authorization", auth(student))).status).toBe(403);

    // Deleting the resource deletes the file.
    expect((await request(app).delete(`/api/resources/${id}`).set("Authorization", auth(instructor))).status).toBe(200);
    await expect(localDriver.get(row.storage_key)).rejects.toMatchObject({ code: "FILE_NOT_FOUND" });
  });

  test("a resource from before file storage explains that its original was not kept", async () => {
    const id = uploadedId(await upload(instructor));
    await pool.query("UPDATE resources SET storage_key = NULL WHERE id = $1", [id]);
    const res = await request(app).get(`/api/resources/${id}/file`).set("Authorization", auth(instructor));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NO_ORIGINAL_FILE");
  });
});

describe("reports", () => {
  const TF = { question_type: "true_false", question_count: 3, duration_per_question: 60, positive_marks: 1, negative_marks: 0 };
  const finishedAttempt = async () => {
    const created = await request(app)
      .post("/api/assessments")
      .set("Authorization", auth(instructor))
      .field("title", "Plants")
      .field("prompt", "Photosynthesis")
      .field("question_blocks", JSON.stringify([TF]))
      .attach("files", Buffer.from(LESSON), { filename: "lesson.txt", contentType: "text/plain" });
    const id = created.body.data.id;
    await request(app).post(`/api/assessments/${id}/publish`).set("Authorization", auth(instructor)).send({ languages: ["en"] });
    const student = await createUser({ role: "student" });
    await enroll({ id }, student);
    let current = (await request(app).post(`/api/taking/assessments/${id}/start`).set("Authorization", auth(student)).send({ language: "en" })).body.data;
    for (let i = 0; i < current.totalQuestions; i++) {
      await request(app)
        .put(`/api/taking/attempts/${current.attemptId}/answers/${current.question.id}`)
        .set("Authorization", auth(student))
        .send({ answer: true });
      const next = (await request(app).post(`/api/taking/attempts/${current.attemptId}/advance`).set("Authorization", auth(student)).send({ fromIndex: i })).body.data;
      if (next.finished) break;
      current = next;
    }
    return { id, student };
  };

  test("a report is stored in file storage and handed out as a short-lived link to its owner only", async () => {
    const { id, student } = await finishedAttempt();
    const link = await request(app).get(`/api/student-analytics/results/${id}/report.pdf?as=link&language=en`).set("Authorization", auth(student));
    expect(link.status).toBe(200);
    expect(link.body.data.language).toBe("en");
    const pdf = await fetchSigned(link.body.data.url);
    expect(pdf.body.toString()).toBe("%PDF-1.4 fake report");
    const row = (await pool.query("SELECT pdf, pdf_storage_key FROM learning_reports")).rows[0];
    expect(row.pdf).toBeNull();
    expect((await storage.get(row.pdf_storage_key)).toString()).toBe("%PDF-1.4 fake report");

    const stranger = await createUser({ role: "student" });
    const denied = await request(app).get(`/api/student-analytics/results/${id}/report.pdf?as=link`).set("Authorization", auth(stranger));
    expect(denied.status).toBeGreaterThanOrEqual(400);
    expect(denied.body.data?.url).toBeUndefined();
  });

  test("npm run storage:migrate moves reports cached in the database into storage", async () => {
    const { id, student } = await finishedAttempt();
    await request(app).get(`/api/student-analytics/results/${id}/report.pdf?as=link&language=en`).set("Authorization", auth(student));
    // A Phase 2 row: bytes in the BYTEA column, no storage key, no file.
    const { attempt_id: attemptId } = (await pool.query("SELECT attempt_id FROM learning_reports")).rows[0];
    await pool.query("UPDATE learning_reports SET pdf = $1, pdf_storage_key = NULL", [Buffer.from("%PDF old bytes")]);
    await storage.delete(`reports/${attemptId}/en.pdf`);

    const summary = await migrateStorage({ log: () => {} });
    expect(summary.reportsMoved).toBe(1);
    const row = (await pool.query("SELECT pdf, pdf_storage_key FROM learning_reports")).rows[0];
    expect(row).toEqual({ pdf: null, pdf_storage_key: `reports/${attemptId}/en.pdf` });
    expect((await storage.get(row.pdf_storage_key)).toString()).toBe("%PDF old bytes");
    expect((await migrateStorage({ log: () => {} })).reportsMoved).toBe(0); // safe to run again
  });

  test("--copy-local copies every local file to R2 under the same key, once", async () => {
    await localDriver.put("resources/7/notes.pdf", Buffer.from("A"));
    await localDriver.put("reports/3/en.pdf", Buffer.from("B"));
    const remote = new Map([["reports/3/en.pdf", Buffer.from("B")]]);
    const fakeR2 = {
      name: "r2",
      put: async (key, body) => remote.set(key, body),
      get: async (key) => remote.get(key),
      list: async () => [...remote.keys()],
    };
    const saved = process.env.STORAGE_DRIVER;
    process.env.STORAGE_DRIVER = "r2";
    storageAdapter.driver = fakeR2;
    try {
      const summary = await migrateStorage({ copyLocal: true, log: () => {} });
      expect(summary).toMatchObject({ localCopied: 1, localSkipped: 1 });
      expect(remote.get("resources/7/notes.pdf").toString()).toBe("A");
      expect((await migrateStorage({ copyLocal: true, log: () => {} })).localCopied).toBe(0);
    } finally {
      storageAdapter.driver = null;
      process.env.STORAGE_DRIVER = saved;
    }
  });
});
