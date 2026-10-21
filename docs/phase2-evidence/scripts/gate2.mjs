/**
 * Gate 2, end to end through the real API (fake LLM/email/embeddings, real Chromium PDFs)
 * on a throwaway database. Prints PASS/FAIL per check with evidence and writes artifacts
 * (PDFs, DOCX) to <outDir>.  Usage: node gate2.mjs <backendDir> <outDir>
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { pathToFileURL } from "url";

const [backendDir, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const imp = (rel) => import(pathToFileURL(path.join(backendDir, rel)).href);
const require = createRequire(path.join(backendDir, "package.json"));

Object.assign(process.env, {
  NODE_ENV: "test",
  JWT_SECRET: "gate-jwt-secret",
  FRONTEND_URL: "http://localhost:5174",
  EMAIL_USER: "noreply@example.com",
  EMAIL_PASS: "unused",
  RECAPTCHA_SECRET_KEY: "unused",
  FIREBASE_PROJECT_ID: "gate",
  FIREBASE_CLIENT_EMAIL: "gate@example.com",
  FIREBASE_PRIVATE_KEY: "unused",
  GEMINI_CREATION_API_KEY_1: "unused",
  GEMINI_CREATION_API_KEY_2: "",
  GEMINI_CHECKING_API_KEY: "unused",
  GROQ_API_KEY: "",
  TRUST_PROXY: "",
  OCR_GEMINI_FALLBACK: "",
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
const JSZip = require("jszip");
const { default: app } = await imp("app.js");
const { queueAdapter } = await imp("jobs/queue.js");
const { DIFFICULTY_WEIGHTS } = await imp("services/engine/adaptiveConfig.js");
const { pool, resetDatabase, createUser, auth, installFakes, enroll } = await imp("tests/helpers.js");
await resetDatabase();
installFakes();
queueAdapter.mode = "inline";

const results = [];
const check = (name, pass, evidence) => {
  results.push({ name, pass, evidence });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}\n      ${evidence.split("\n").join("\n      ")}`);
};
const as = (u) => ({ Authorization: auth(u) });

const superAdmin = await createUser({ role: "super_admin", name: "Gate Super" });
const admin = await createUser({ role: "admin", name: "Gate Admin" });
const instructor = await createUser({ role: "instructor", name: "Gate Instructor" });
const students = [];
for (let i = 0; i < 6; i++) students.push(await createUser({ role: "student", name: `Gate Student ${i}` }));
const outsider = await createUser({ role: "student", name: "Gate Outsider" });

const LESSON = Array.from({ length: 40 }, (_, i) => `Fact ${i}: plants make sugar from light and water in the chloroplasts of their leaves.`).join(" ");
const created = await request(app)
  .post("/api/assessments")
  .set(as(instructor))
  .field("title", "Gate 2 adaptive")
  .field("prompt", "Photosynthesis")
  .field("adaptive", "true")
  .field("question_blocks", JSON.stringify([{ question_type: "true_false", question_count: 8, duration_per_question: 60, positive_marks: 1, negative_marks: 0 }]))
  .attach("files", Buffer.from(LESSON), { filename: "lesson.txt", contentType: "text/plain" });
const id = created.body.data.id;
await request(app).post(`/api/assessments/${id}/publish`).set(as(instructor)).send({ languages: ["en", "ur", "ar"] });
for (const s of students) await enroll({ id }, s);

const flip = (v) => (typeof v === "boolean" ? !v : String(v).toLowerCase() === "true" ? "false" : "true");
const take = async (s, language, decide) => {
  const started = await request(app).post(`/api/taking/assessments/${id}/start`).set(as(s)).send({ language });
  if (started.status !== 200) throw new Error(`start ${started.status} ${JSON.stringify(started.body)}`);
  let current = started.body.data;
  for (let i = 0; i < current.totalQuestions; i++) {
    const right = (await pool.query("SELECT correct_answer FROM generated_questions WHERE id = $1", [current.question.id])).rows[0].correct_answer;
    await request(app)
      .put(`/api/taking/attempts/${current.attemptId}/answers/${current.question.id}`)
      .set(as(s))
      .send({ answer: decide(i) ? right : flip(right) });
    const next = (await request(app).post(`/api/taking/attempts/${current.attemptId}/advance`).set(as(s)).send({ fromIndex: i })).body.data;
    if (next.finished) return { attemptId: current.attemptId, result: next.result };
    current = next;
  }
  throw new Error("did not finish");
};
const questionsOf = async (attemptId) =>
  (await pool.query("SELECT pool_question_id, objective_id, difficulty, language FROM generated_questions WHERE attempt_id = $1 ORDER BY question_order", [attemptId])).rows;

// 1. Different sets, same objective coverage.
const a = await take(students[0], "en", () => true);
const b = await take(students[1], "en", (i) => i < 4);
const qa = await questionsOf(a.attemptId);
const qb = await questionsOf(b.attemptId);
const count = (qs) => qs.reduce((m, q) => ((m[q.objective_id] = (m[q.objective_id] || 0) + 1), m), {});
const idsA = qa.map((q) => q.pool_question_id).sort((x, y) => x - y).join(",");
const idsB = qb.map((q) => q.pool_question_id).sort((x, y) => x - y).join(",");
const shared = qa.filter((q) => qb.some((r) => r.pool_question_id === q.pool_question_id)).length;
check(
  "Two students get different question sets covering the same objectives the same number of times",
  idsA !== idsB && JSON.stringify(count(qa)) === JSON.stringify(count(qb)),
  `student A pool ids: ${idsA}\nstudent B pool ids: ${idsB}\nshared questions: ${shared}/${qa.length}\nobjective counts A: ${JSON.stringify(count(qa))}\nobjective counts B: ${JSON.stringify(count(qb))}`
);

// 2. Difficulty adapts; adjusted score recomputed independently.
const pathA = qa.map((q) => q.difficulty);
const pathB = qb.map((q) => q.difficulty);
const recompute = async (attemptId) => {
  const rows = (
    await pool.query(
      `SELECT g.difficulty, g.positive_marks, sa.is_correct, COALESCE(sa.score, 0) AS score
         FROM generated_questions g LEFT JOIN student_answers sa ON sa.attempt_id = g.attempt_id AND sa.question_id = g.id
        WHERE g.attempt_id = $1`,
      [attemptId]
    )
  ).rows;
  let adjusted = 0;
  let max = 0;
  for (const r of rows) {
    max += Number(r.positive_marks);
    if (r.is_correct) adjusted += Number(r.positive_marks) * DIFFICULTY_WEIGHTS[r.difficulty];
    else adjusted += Math.min(0, Number(r.score));
  }
  return Math.round(Math.min(100, (Math.max(0, adjusted) / max) * 100) * 100) / 100;
};
const stored = async (attemptId) =>
  (await pool.query("SELECT raw_percentage, adjusted_percentage, difficulty_path FROM assessment_attempts WHERE id = $1", [attemptId])).rows[0];
const sa = await stored(a.attemptId);
const sb = await stored(b.attemptId);
const expA = await recompute(a.attemptId);
const expB = await recompute(b.attemptId);
const rises = pathA.some((d, i) => i && d > pathA[i - 1]);
const falls = pathB.some((d, i) => i && d < pathB[i - 1]);
check(
  "Difficulty visibly adapts and the adjusted score is correct",
  rises && falls && Number(sa.adjusted_percentage) === expA && Number(sb.adjusted_percentage) === expB,
  `A (all correct) path: ${pathA.join(" → ")}; raw ${sa.raw_percentage}%, adjusted ${sa.adjusted_percentage}% (recomputed ${expA}%)\nB (4 right, 4 wrong) path: ${pathB.join(" → ")}; raw ${sb.raw_percentage}%, adjusted ${sb.adjusted_percentage}% (recomputed ${expB}%)\nweights: ${JSON.stringify(DIFFICULTY_WEIGHTS)}`
);

// 3 + 4. Urdu and Arabic: exam, immediate results, PDF report in the student's language.
const langEvidence = [];
let langPass = true;
let resultsPass = true;
const resultsEvidence = [];
for (const [s, lang] of [
  [students[2], "ur"],
  [students[3], "ar"],
]) {
  await pool.query("UPDATE users SET language_preference = $1 WHERE id = $2", [lang, s.id]);
  const t = await take(s, lang, (i) => i % 2 === 0);
  const qs = await questionsOf(t.attemptId);
  const langs = [...new Set(qs.map((q) => q.language))];
  const stem = (await pool.query("SELECT question_text FROM generated_questions WHERE attempt_id = $1 LIMIT 1", [t.attemptId])).rows[0].question_text;
  const res = await request(app).get(`/api/student-analytics/results/${id}`).set(as(s));
  const pdf = await request(app)
    .get(`/api/student-analytics/results/${id}/report.pdf`)
    .set(as(s))
    .buffer(true)
    .parse((r, done) => {
      const c = [];
      r.on("data", (x) => c.push(x));
      r.on("end", () => done(null, Buffer.concat(c)));
    });
  const file = path.join(outDir, `report-${lang}.pdf`);
  fs.writeFileSync(file, pdf.body);
  const text = pdf.body.toString("latin1");
  const font = lang === "ur" ? /NotoNastaliqUrdu/ : /NotoNaskhArabic/;
  const okLang = langs.length === 1 && langs[0] === lang && pdf.status === 200 && text.startsWith("%PDF") && font.test(text);
  langPass &&= okLang;
  langEvidence.push(
    `${lang}: questions served in [${langs}] e.g. "${stem.slice(0, 60)}"; report.pdf ${pdf.status}, ${pdf.body.length} bytes, embeds ${font.source}: ${font.test(text)} → ${path.basename(file)}`
  );
  const immediate = Boolean(t.result) && res.status === 200 && res.body.data.review?.length === qs.length;
  resultsPass &&= immediate && pdf.status === 200;
  resultsEvidence.push(
    `${lang}: result returned with the last answer (raw ${t.result?.rawPercentage}%, adjusted ${t.result?.adjustedPercentage}%); GET results ${res.status} with ${res.body.data?.review?.length} reviewed questions, ${res.body.data?.objectives?.length} objectives; report downloaded (${pdf.body.length} bytes)`
  );
}
check(
  "Urdu and Arabic: exam, results and PDF report in the student's language (UI RTL: see screenshots)",
  langPass,
  langEvidence.join("\n")
);
check("Student sees results immediately and downloads a full report", resultsPass, resultsEvidence.join("\n"));

// 5. Admin scope.
const g = (await request(app).post("/api/groups").set(as(superAdmin)).send({ name: "Gate group" })).body.data;
const members = [admin, instructor, students[0], students[1]];
await request(app)
  .post(`/api/groups/${g.id}/members`)
  .set(as(superAdmin))
  .send({ emails: members.map((m) => m.email) });
const seen = (await request(app).get("/api/auth/users").set(as(admin))).body.users.map((u) => u.email);
const changeOutside = await request(app).put("/api/auth/change-role").set(as(admin)).send({ userId: outsider.id, newRole: "instructor" });
const changeInside = await request(app).put("/api/auth/change-role").set(as(admin)).send({ userId: students[1].id, newRole: "instructor" });
const groupsSeen = (await request(app).get("/api/groups").set(as(admin))).body.data.map((x) => x.name);
check(
  "An admin only sees their own group",
  !seen.includes(outsider.email) && !seen.includes(students[4].email) && seen.includes(students[0].email) && changeOutside.status === 403 && changeInside.status === 200,
  `admin sees users: ${seen.join(", ")}\nadmin sees groups: ${groupsSeen.join(", ")}\nchange role of outsider: ${changeOutside.status} ${changeOutside.body.code || ""}; of own group member: ${changeInside.status}`
);

// 6. Printing.
const printEvidence = [];
let printPass = true;
for (const format of ["pdf", "docx"]) {
  for (const [mode, copies] of [
    ["same", 1],
    ["unique", 3],
  ]) {
    const res = await request(app)
      .post(`/api/assessments/${id}/print`)
      .set(as(instructor))
      .send({ language: "ur", mode, copies, format, instituteName: "گورنمنٹ ہائی اسکول", teacherName: "Iqra Instructor", subjectName: "Biology" })
      .buffer(true)
      .parse((r, done) => {
        const c = [];
        r.on("data", (x) => c.push(x));
        r.on("end", () => done(null, Buffer.concat(c)));
      });
    const file = path.join(outDir, `paper-${mode}.${format}`);
    fs.writeFileSync(file, res.body);
    let detail = "";
    let ok = res.status === 200;
    if (format === "pdf") ok &&= res.body.subarray(0, 4).toString() === "%PDF";
    else {
      ok &&= res.body.subarray(0, 2).toString() === "PK";
      const xml = await (await JSZip.loadAsync(res.body)).file("word/document.xml").async("string");
      const plain = xml.replace(/<[^>]+>/g, "");
      const codes = ["A", "B", "C"].filter((c) => new RegExp(`\\b${c}\\b`).test(plain)).length;
      const rtl = /<w:bidi\/>|<w:rtl\/>/.test(xml);
      const header = plain.includes("گورنمنٹ ہائی اسکول") && plain.includes("Iqra Instructor");
      detail = `, header printed as typed: ${header}, RTL runs: ${rtl}`;
      ok &&= header && rtl;
    }
    printPass &&= ok;
    printEvidence.push(`${format.toUpperCase()} ${mode}${mode === "unique" ? ` x${copies}` : ""}: ${res.status} ${res.headers["content-type"]}, ${res.body.length} bytes${detail} → ${path.basename(file)}`);
  }
}
check("A paper prints as PDF and DOCX, both same-paper and unique-paper modes", printPass, printEvidence.join("\n"));

fs.writeFileSync(path.join(outDir, "gate2.json"), JSON.stringify(results, null, 2));
console.log(`GATE2 ${results.filter((r) => r.pass).length}/${results.length} passed`);
await pool.end();
process.exit(0);
