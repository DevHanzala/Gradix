/**
 * Demo backend for screenshots: throwaway Docker database, fake LLM/email/embeddings
 * (the test fakes), seeded through the real API. Never loads real keys: every
 * secret-like variable is set (empty or dummy) before any app module is imported.
 * Usage: node demoServer.mjs <backendDir> <port>   (PG* env from the caller)
 */
import path from "path";
import { createRequire } from "module";
import { pathToFileURL } from "url";

const backendDir = process.argv[2];
const port = Number(process.argv[3] || 5055);
const imp = (rel) => import(pathToFileURL(path.join(backendDir, rel)).href);
const require = createRequire(path.join(backendDir, "package.json"));

Object.assign(process.env, {
  NODE_ENV: "test",
  JWT_SECRET: "demo-jwt-secret-not-for-production",
  FRONTEND_URL: "http://localhost:5174",
  EMAIL_USER: "noreply@example.com",
  EMAIL_PASS: "unused",
  RECAPTCHA_SECRET_KEY: "unused",
  FIREBASE_PROJECT_ID: "demo",
  FIREBASE_CLIENT_EMAIL: "demo@example.com",
  FIREBASE_PRIVATE_KEY: "unused",
  GEMINI_CREATION_API_KEY_1: "unused",
  GEMINI_CREATION_API_KEY_2: "",
  GEMINI_CHECKING_API_KEY: "unused",
  GROQ_API_KEY: "",
  TRUST_PROXY: "",
  OCR_GEMINI_FALLBACK: "",
  LLM_PRICES_JSON: "",
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
const { default: app } = await imp("app.js");
const { queueAdapter } = await imp("jobs/queue.js");
const { pdfRenderer } = await imp("helper/pdfRenderer.js");
const h = await imp("tests/helpers.js");
const { pool, resetDatabase, createUser, auth, installFakes, enroll } = h;

await resetDatabase();
const fakes = installFakes();
queueAdapter.mode = "inline";
void pdfRenderer;

const mk = (name, role, email) => createUser({ name, role, email });
const superAdmin = await mk("Sara Super", "super_admin", "super@demo.io");
const admin = await mk("Adam Admin", "admin", "admin@demo.io");
const instructor = await mk("Iqra Instructor", "instructor", "instructor@demo.io");
const viewer = await mk("Ali Student", "student", "student@demo.io");
const takers = [];
for (const l of ["en", "ur", "ar"]) takers.push(await mk(`Taker ${l}`, "student", `take-${l}@demo.io`));
const names = ["Bilal Khan", "Fatima Noor", "Hassan Raza", "Zainab Ahmed", "Omar Farooq", "Ayesha Malik", "Usman Tariq"];
const others = [];
for (const [i, n] of names.entries()) others.push(await mk(n, "student", `s${i}@demo.io`));

const as = (u) => ({ Authorization: auth(u) });
const ok = (res, what) => {
  if (res.status >= 300) throw new Error(`${what}: ${res.status} ${JSON.stringify(res.body).slice(0, 300)}`);
  return res.body;
};

// Groups
const g = ok(await request(app).post("/api/groups").set(as(superAdmin)).send({ name: "Class 9-A" }), "group").data;
ok(
  await request(app)
    .post(`/api/groups/${g.id}/members`)
    .set(as(superAdmin))
    .send({ emails: ["admin@demo.io", "instructor@demo.io", "student@demo.io", ...others.map((o) => o.email)] }),
  "members"
);
ok(await request(app).post("/api/groups").set(as(superAdmin)).send({ name: "Class 10-B (Science)" }), "group2");

const LESSON = Array.from(
  { length: 40 },
  (_, i) => `Fact ${i}: plants make sugar from light, water and carbon dioxide in the chloroplasts of their leaves.`
).join(" ");
const TF = { question_type: "true_false", question_count: 4, duration_per_question: 60, positive_marks: 1, negative_marks: 0 };
const MCQ = { question_type: "multiple_choice", question_count: 4, duration_per_question: 90, positive_marks: 2, negative_marks: 0.5, num_options: 4 };

const createAssessment = async (title, extra = {}) => {
  let req = request(app)
    .post("/api/assessments")
    .set(as(instructor))
    .field("title", title)
    .field("prompt", "Photosynthesis for grade 9: inputs, outputs, chlorophyll and where it happens.")
    .field("question_blocks", JSON.stringify([TF, MCQ]))
    .field("external_links", JSON.stringify(["https://example.org/photosynthesis"]));
  for (const [k, v] of Object.entries(extra)) req = req.field(k, v);
  req = req.attach("files", Buffer.from(LESSON), { filename: "photosynthesis-notes.txt", contentType: "text/plain" });
  return ok(await req, "create").data.id;
};
const publish = async (id) => ok(await request(app).post(`/api/assessments/${id}/publish`).set(as(instructor)).send({ languages: ["en", "ur"] }), "publish");

const examId = await createAssessment("Photosynthesis unit test");
await publish(examId);
const liveId = await createAssessment("Plant cells quiz");
await publish(liveId);
await createAssessment("Respiration (draft)");

for (const s of [viewer, ...others]) {
  await enroll({ id: examId }, s);
  await enroll({ id: liveId }, s);
}

const correctOf = async (qid) => (await pool.query("SELECT correct_answer FROM generated_questions WHERE id = $1", [qid])).rows[0].correct_answer;
const take = async (id, s, rate, language = "en") => {
  let current = ok(await request(app).post(`/api/taking/assessments/${id}/start`).set(as(s)).send({ language }), "start").data;
  for (let i = 0; i < current.totalQuestions; i++) {
    const right = await correctOf(current.question.id);
    const good = (i * 37 + s.id * 11) % 100 < rate;
    let answer = right;
    if (!good) {
      const opts = current.question.options;
      answer = Array.isArray(opts) && opts.length ? opts.find((o) => (o.key ?? o) !== right)?.key ?? "B" : right === "true" || right === true ? "false" : "true";
    }
    await request(app).put(`/api/taking/attempts/${current.attemptId}/answers/${current.question.id}`).set(as(s)).send({ answer });
    const next = ok(await request(app).post(`/api/taking/attempts/${current.attemptId}/advance`).set(as(s)).send({ fromIndex: i }), "advance").data;
    if (next.finished) return next.result;
    current = next;
  }
  throw new Error("did not finish");
};
const rates = [90, 75, 60, 45, 30, 85, 55];
await take(examId, viewer, 55);
for (const [i, s] of others.entries()) await take(examId, s, rates[i]);
// Takers start the second assessment from the screenshot script (question timers are short).
for (const s of takers) await enroll({ id: liveId }, s);
// Someone outside every group: admins must not see them.
await mk("Outside Person", "student", "outside@demo.io");

// A link and a duplicate in the library.
await request(app).post("/api/resources").set(as(instructor)).field("url", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");

// Some AI usage history for platform stats.
const purposes = ["question_generation", "pool_generation", "objective_extraction", "study_plan", "practice", "pool_on_demand"];
for (let d = 0; d < 30; d++) {
  for (const [i, purpose] of purposes.entries()) {
    const model = i % 3 === 2 ? "llama-3.3-70b-versatile" : "gemini-2.5-flash";
    await pool.query(
      `INSERT INTO llm_usage_log (created_at, purpose, provider, model, input_tokens, output_tokens, latency_ms, success)
       VALUES (NOW() - ($1 || ' days')::interval, $2, $3, $4, $5, $6, $7, $8)`,
      [d, purpose, model.startsWith("gemini") ? "gemini" : "groq", model, 1500 + d * 40, 600 + i * 90, 900 + i * 150, (d + i) % 17 !== 0]
    );
  }
}

const ids = { examId, liveId };
app.listen(port, "127.0.0.1", () => console.log(`DEMO READY ${port} ${JSON.stringify(ids)} emails=${fakes.sentEmails.length}`));
