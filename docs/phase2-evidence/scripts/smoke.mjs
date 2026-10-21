/**
 * Live Gemini smoke test: one tiny resource -> objectives -> a small pool in English and Urdu.
 * Real LLM keys come from backend/.env via the app's own dotenv (cwd = backend); they are never
 * printed. Database (PG*) and email are set by this script before the app loads, so the
 * developer database is never touched and no email leaves the machine.
 */
import path from "path";
import { createRequire } from "module";
import { pathToFileURL } from "url";

const backendDir = process.cwd();
const imp = (rel) => import(pathToFileURL(path.join(backendDir, rel)).href);
const require = createRequire(path.join(backendDir, "package.json"));
const redact = (s) => String(s).replace(/AIza[0-9A-Za-z_-]{20,}/g, "[key]").replace(/gsk_[0-9A-Za-z]{20,}/g, "[key]").slice(0, 300);

Object.assign(process.env, {
  NODE_ENV: "test",
  JWT_SECRET: "smoke-jwt-secret",
  EMAIL_USER: "noreply@example.com",
  EMAIL_PASS: "unused",
  FRONTEND_URL: "http://localhost:5174",
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
const { default: app } = await imp("app.js");
const { queueAdapter } = await imp("jobs/queue.js");
const { mailer } = await imp("helper/emailService.js");
const { pool, resetDatabase, createUser, auth } = await imp("tests/helpers.js");
mailer.send = async () => {};
queueAdapter.mode = "inline";
await resetDatabase();

const instructor = await createUser({ role: "instructor", name: "Smoke Instructor" });
const LESSON = `Photosynthesis is the process green plants use to make their own food.
Plants take in carbon dioxide from the air through small pores called stomata, and water from the soil through their roots.
Chlorophyll, the green pigment inside chloroplasts, absorbs sunlight. The light energy splits water molecules and releases oxygen as a by-product.
The plant then uses the energy to turn carbon dioxide into glucose, a sugar it uses for growth or stores as starch.
Photosynthesis mainly happens in the leaves, because leaf cells contain the most chloroplasts.`;

const t0 = Date.now();
const created = await request(app)
  .post("/api/assessments")
  .set("Authorization", auth(instructor))
  .field("title", "Smoke: photosynthesis")
  .field("prompt", "Grade 8 science, photosynthesis basics")
  .field("adaptive", "false")
  .field("question_blocks", JSON.stringify([{ question_type: "multiple_choice", question_count: 3, duration_per_question: 60, positive_marks: 1, negative_marks: 0, num_options: 4 }]))
  .attach("files", Buffer.from(LESSON), { filename: "photosynthesis.txt", contentType: "text/plain" });
console.log(`create: ${created.status} ${created.status >= 300 ? redact(JSON.stringify(created.body)) : ""}`);
const id = created.body?.data?.id;
if (!id) process.exit(1);

const assessment = (await pool.query("SELECT status FROM assessments WHERE id = $1", [id])).rows[0];
const objectives = (await pool.query("SELECT text, weight FROM learning_objectives WHERE assessment_id = $1 ORDER BY sort_order", [id])).rows;
console.log(`status after create: ${assessment.status}; objectives: ${objectives.length}`);
for (const o of objectives) console.log(`  - (${o.weight}) ${o.text}`);

const published = await request(app).post(`/api/assessments/${id}/publish`).set("Authorization", auth(instructor)).send({ languages: ["en", "ur"] });
console.log(`publish: ${published.status} ${published.status >= 300 ? redact(JSON.stringify(published.body)) : ""}`);

const states = (await pool.query("SELECT language, state, error FROM pool_language_state WHERE assessment_id = $1 ORDER BY language", [id])).rows;
console.log(`pool: ${JSON.stringify(states)}`);
for (const lang of ["en", "ur"]) {
  const q = (await pool.query("SELECT question_text, options, difficulty FROM question_pool WHERE assessment_id = $1 AND language = $2 ORDER BY id LIMIT 2", [id, lang])).rows;
  const n = (await pool.query("SELECT COUNT(*)::int AS n FROM question_pool WHERE assessment_id = $1 AND language = $2", [id, lang])).rows[0].n;
  console.log(`questions ${lang}: ${n}`);
  for (const r of q) console.log(`  - [d${r.difficulty}] ${r.question_text} | ${JSON.stringify(r.options).slice(0, 160)}`);
}

const usage = (
  await pool.query(
    `SELECT purpose, provider, model, COUNT(*)::int AS calls, SUM(CASE WHEN success THEN 1 ELSE 0 END)::int AS ok,
            SUM(input_tokens)::int AS input_tokens, SUM(output_tokens)::int AS output_tokens, ROUND(AVG(latency_ms))::int AS avg_ms,
            BOOL_OR(tokens_estimated) AS estimated
       FROM llm_usage_log GROUP BY purpose, provider, model ORDER BY purpose`
  )
).rows;
console.log("usage:");
for (const u of usage) console.log(`  ${JSON.stringify(u)}`);
const errors = (await pool.query("SELECT purpose, error FROM llm_usage_log WHERE NOT success LIMIT 5")).rows;
for (const e of errors) console.log(`  error ${e.purpose}: ${redact(e.error)}`);
console.log(`total seconds: ${Math.round((Date.now() - t0) / 1000)}`);
await pool.end();
process.exit(0);
