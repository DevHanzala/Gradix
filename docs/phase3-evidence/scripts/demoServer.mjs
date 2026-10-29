/**
 * Demo backend for Phase 3 browser checks: a throwaway database, the test fakes for
 * AI/email/embeddings/captcha, real HTTP + Socket.IO. Never loads real keys: every
 * secret-like variable is set (empty or dummy) before any app module is imported.
 *
 *   node demoServer.mjs <backendDir> <port> [--resume]    (PG* env from the caller)
 *
 * Without --resume the database is reset and seeded; with --resume the existing data is
 * kept (used to prove that live sessions survive a backend restart).
 * Prints "DEMO READY <port> <json ids>" when listening.
 */
import os from "os";
import path from "path";
import { createRequire } from "module";
import { pathToFileURL } from "url";

const backendDir = path.resolve(process.argv[2]);
const port = Number(process.argv[3] || 5056);
const resume = process.argv.includes("--resume");
const imp = (rel) => import(pathToFileURL(path.join(backendDir, rel)).href);
const require = createRequire(path.join(backendDir, "package.json"));

Object.assign(process.env, {
  NODE_ENV: "test",
  JWT_SECRET: "demo-jwt-secret-not-for-production",
  FRONTEND_URL: process.env.DEMO_FRONTEND_URL || "http://localhost:5174",
  EMAIL_PROVIDER: "smtp",
  EMAIL_USER: "noreply@example.com",
  EMAIL_PASS: "unused",
  EMAIL_FROM: "",
  BREVO_API_KEY: "",
  RESEND_API_KEY: "",
  RECAPTCHA_SECRET_KEY: "unused",
  FIREBASE_PROJECT_ID: "demo",
  FIREBASE_CLIENT_EMAIL: "demo@example.com",
  FIREBASE_PRIVATE_KEY: "unused",
  GEMINI_API_KEYS: "",
  GEMINI_API_KEY: "",
  GEMINI_CREATION_API_KEY_1: "unused",
  GEMINI_CREATION_API_KEY_2: "",
  GROQ_API_KEY: "",
  TRUST_PROXY: "",
  OCR_GEMINI_FALLBACK: "",
  STORAGE_DRIVER: "local",
  STORAGE_LOCAL_DIR: path.join(os.tmpdir(), "gradix-demo-storage"),
  R2_ACCOUNT_ID: "",
  R2_ACCESS_KEY_ID: "",
  R2_SECRET_ACCESS_KEY: "",
  R2_BUCKET: "",
  SENTRY_DSN: "",
  SUPERADMIN_PASSWORD: "",
  SEED_PASSWORD: "",
});

const { runner } = require("node-pg-migrate");
await runner({
  databaseUrl: { host: process.env.PGHOST, port: Number(process.env.PGPORT), database: process.env.PGDATABASE, user: process.env.PGUSER, password: process.env.PGPASSWORD },
  dir: path.join(backendDir, "migrations"),
  direction: "up",
  count: Infinity,
  migrationsTable: "pgmigrations",
  log: () => {},
});

const request = require("supertest");
const { createServer } = await import("http");
const { default: app } = await imp("app.js");
const { queueAdapter } = await imp("jobs/queue.js");
const { attachRealtime } = await imp("services/live/realtime.js");
const h = await imp("tests/helpers.js");
const { pool, resetDatabase, createUser, auth, installFakes, enroll } = h;

installFakes();
queueAdapter.mode = "inline";

const ids = {};
if (!resume) {
  await resetDatabase();
  const mk = (name, role, email) => createUser({ name, role, email });
  ids.instructor = (await mk("Iqra Instructor", "instructor", "instructor@demo.io")).id;
  ids.students = [];
  for (const [n, e] of [
    ["Ali Raza", "ali@demo.io"],
    ["Sana Khan", "sana@demo.io"],
    ["Bilal Ahmed", "bilal@demo.io"],
  ]) {
    ids.students.push((await mk(n, "student", e)).id);
  }
  const instructor = (await pool.query("SELECT id, email, role FROM users WHERE id = $1", [ids.instructor])).rows[0];
  const lesson = Array.from({ length: 40 }, (_, i) => `Fact ${i}: plants make sugar from light and water in their leaves.`).join(" ");
  const created = await request(app)
    .post("/api/assessments")
    .set("Authorization", auth(instructor))
    .field("title", "Photosynthesis quiz")
    .field("prompt", "How plants make food")
    .field(
      "question_blocks",
      JSON.stringify([{ question_type: "multiple_choice", question_count: 4, duration_per_question: 60, num_options: 4, positive_marks: 1, negative_marks: 0 }])
    )
    .attach("files", Buffer.from(lesson), { filename: "lesson.txt", contentType: "text/plain" });
  ids.assessment = created.body.data.id;
  await request(app).post(`/api/assessments/${ids.assessment}/publish`).set("Authorization", auth(instructor)).send({ languages: ["en", "ur"] });
  for (const sid of ids.students) await enroll({ id: ids.assessment }, { id: sid });
}

const server = createServer(app);
await attachRealtime(server);
server.listen(port, "127.0.0.1", () => console.log(`DEMO READY ${port} ${JSON.stringify(ids)}`));
const stop = () => server.close(() => process.exit(0));
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
