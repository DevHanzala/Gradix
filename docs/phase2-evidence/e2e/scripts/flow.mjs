/**
 * Real-stack end-to-end run: a real backend process (`node index.js`, background jobs in
 * the API, pg-boss on Postgres), real AI keys, production frontend build, and a browser
 * clicking through the app. Usage: node flow.mjs <rootDir> <outDir>
 * Env: PG* (throwaway DB), E2E_JWT_SECRET (same as the backend's JWT_SECRET).
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const [rootDir, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const require = createRequire(path.join(rootDir, "backend", "package.json"));
const puppeteer = require("puppeteer");
const jwt = require("jsonwebtoken");
const pg = require("pg");

const APP = "http://localhost:5175";
const API = "http://localhost:5066/api";
const db = new pg.Client({ host: process.env.PGHOST, port: Number(process.env.PGPORT), database: process.env.PGDATABASE, user: process.env.PGUSER, password: process.env.PGPASSWORD });
await db.connect();

const results = [];
const step = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `\n      ${String(detail).split("\n").join("\n      ")}` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const elapsed = () => `${Math.round((Date.now() - t0) / 1000)}s`;

const userByEmail = async (email) => (await db.query("SELECT id, name, email, role, language_preference FROM users WHERE email = $1", [email])).rows[0];
const tokenFor = (u) => jwt.sign({ id: u.id, email: u.email, role: u.role }, process.env.E2E_JWT_SECRET, { expiresIn: "2h" });
const api = async (u, method, url, body) => {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: { Authorization: `Bearer ${tokenFor(u)}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = res.headers.get("content-type") || "";
  return { status: res.status, type, body: type.includes("json") ? await res.json() : Buffer.from(await res.arrayBuffer()) };
};

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const consoleErrors = [];
const openAs = async (u, lang, url, width = 1280) => {
  const page = await browser.newPage();
  page.on("pageerror", (e) => consoleErrors.push(`${url}: ${e.message.slice(0, 160)}`));
  page.on("response", (r) => r.url().startsWith(API) && r.status() >= 500 && consoleErrors.push(`${url}: HTTP ${r.status()} ${r.url().replace(API, "")}`));
  await page.setViewport({ width, height: 900 });
  const user = { id: u.id, name: u.name, email: u.email, role: u.role, verified: true, language: lang };
  await page.evaluateOnNewDocument(
    (token, user, lang) => {
      if (sessionStorage.getItem("__seeded")) return;
      sessionStorage.setItem("__seeded", "1");
      localStorage.setItem("token", token);
      localStorage.setItem("auth-storage", JSON.stringify({ state: { token, user }, version: 0 }));
      localStorage.setItem("gradix.language", lang);
    },
    tokenFor(u),
    user,
    lang
  );
  await page.goto(APP + url, { waitUntil: "networkidle0", timeout: 60000 });
  return page;
};
const shot = async (page, name) => {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewport({ width: page.viewport().width, height: Math.max(900, Math.min(h, 12000)) });
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
  await page.setViewport({ width: page.viewport().width, height: 900 });
};
const clickButton = async (page, text, { within = "body", exact = false } = {}) => {
  const ok = await page.evaluate(
    (text, within, exact) => {
      const root = document.querySelector(within) || document.body;
      const b = [...root.querySelectorAll("button, a")].find((el) => {
        const s = el.innerText.trim();
        return (exact ? s === text : s.includes(text)) && !el.disabled && el.offsetParent !== null;
      });
      if (b) b.click();
      return Boolean(b);
    },
    text,
    within,
    exact
  );
  if (!ok) throw new Error(`button not found: ${text}`);
};
const fillByLabel = async (page, label, value) => {
  const id = await page.evaluate((label) => {
    const l = [...document.querySelectorAll("label")].find((x) => x.innerText.trim().replace(/\s*\*$/, "") === label);
    return l?.htmlFor || null;
  }, label);
  if (!id) throw new Error(`field not found: ${label}`);
  await page.$eval(`[id="${id}"]`, (el) => {
    el.focus();
    el.select?.();
  });
  await page.keyboard.press("Backspace");
  await page.type(`[id="${id}"]`, String(value));
};
const waitFor = async (what, fn, { timeoutMs = 240000, everyMs = 3000 } = {}) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await fn();
    if (v) return v;
    await sleep(everyMs);
  }
  throw new Error(`timed out waiting for ${what}`);
};

const instructor = await userByEmail("instructor@e2e.invalid");
const superAdmin = await userByEmail("super@e2e.invalid");
const admin = await userByEmail("admin@e2e.invalid");
const studentEn = await userByEmail("student-en@e2e.invalid");
const studentUr = await userByEmail("student-ur@e2e.invalid");

let assessmentId = null;
try {
  // ---------------------------------------------------------- 1. create through the UI
  const lessonFile = path.join(outDir, "photosynthesis-notes.txt");
  fs.writeFileSync(
    lessonFile,
    `Photosynthesis is the process green plants use to make their own food.
Plants take in carbon dioxide from the air through tiny pores called stomata, and water from the soil through their roots.
Chlorophyll, the green pigment inside chloroplasts, absorbs sunlight. The light energy splits water molecules and releases oxygen.
The plant uses that energy to turn carbon dioxide into glucose, a sugar it uses for growth or stores as starch.
Photosynthesis mainly happens in the leaves, because leaf cells contain the most chloroplasts.
Respiration is different: cells break glucose down to release energy, using oxygen and producing carbon dioxide and water.`
  );
  let page = await openAs(instructor, "en", "/instructor/assessments/create");
  await fillByLabel(page, "Title", "E2E: Photosynthesis basics");
  await fillByLabel(page, "Number of questions", "4");
  const fileInput = await page.$("#assessment-files");
  await fileInput.uploadFile(lessonFile);
  await clickButton(page, "Create assessment");
  await page.waitForFunction(() => /\/instructor\/assessments\/\d+\/objectives/.test(location.pathname), { timeout: 60000 });
  assessmentId = Number((await page.evaluate(() => location.pathname)).match(/assessments\/(\d+)/)[1]);
  step("Instructor creates an assessment with an uploaded file (UI)", true, `assessment ${assessmentId}, ${elapsed()}`);

  // ---------------------------------------------------------- 2. objectives appear (real AI, background job in the API process)
  const objectivesState = await waitFor("objectives", async () => {
    const r = (await db.query("SELECT objectives_state, status, objectives_error FROM assessments WHERE id = $1", [assessmentId])).rows[0];
    return r.objectives_state === "ready" || r.objectives_state === "failed" ? r : null;
  });
  const objectives = (await db.query("SELECT text FROM learning_objectives WHERE assessment_id = $1 ORDER BY sort_order", [assessmentId])).rows;
  await page.reload({ waitUntil: "networkidle0" });
  await shot(page, "01-objectives");
  step(
    "Objectives are extracted automatically without a separate worker",
    objectivesState.objectives_state === "ready" && objectives.length >= 3,
    `state ${objectivesState.objectives_state}${objectivesState.objectives_error ? ` (${objectivesState.objectives_error})` : ""}, ${objectives.length} objectives after ${elapsed()}:\n${objectives.map((o) => `- ${o.text}`).join("\n")}`
  );
  const pageText = await page.evaluate(() => document.body.innerText);
  step("Objectives page no longer says it is reading the material", !pageText.includes("Reading your material"), "");

  // ---------------------------------------------------------- 3. publish (en + ur) through the UI
  await page.evaluate(() => {
    const box = [...document.querySelectorAll("label")].find((l) => l.innerText.includes("Arabic"))?.querySelector("input");
    if (box?.checked) box.click();
  });
  await clickButton(page, "Publish", { exact: true });
  await sleep(500);
  await clickButton(page, "Publish", { within: "[role=dialog], [role=alertdialog]", exact: true });
  const published = await waitFor(
    "publishing",
    async () => {
      const r = (await db.query("SELECT status FROM assessments WHERE id = $1", [assessmentId])).rows[0];
      const langs = (await db.query("SELECT language, state, error FROM pool_language_state WHERE assessment_id = $1 ORDER BY language", [assessmentId])).rows;
      if (langs.some((l) => l.state === "failed")) return { status: r.status, langs };
      return r.status === "published" ? { status: r.status, langs } : null;
    },
    { timeoutMs: 480000, everyMs: 5000 }
  );
  const poolCounts = (await db.query("SELECT language, count(*)::int AS n FROM question_pool WHERE assessment_id = $1 AND status = 'active' GROUP BY 1 ORDER BY 1", [assessmentId])).rows;
  await page.reload({ waitUntil: "networkidle0" });
  await shot(page, "02-published");
  step(
    "Publishing builds the English and Urdu question pools",
    published.status === "published",
    `status ${published.status}; ${JSON.stringify(published.langs)}; pool ${JSON.stringify(poolCounts)}; ${elapsed()}`
  );
  await page.close();

  // ---------------------------------------------------------- 4. enroll + student exams through the UI
  for (const s of [studentEn, studentUr]) {
    const r = await api(instructor, "POST", `/assessments/${assessmentId}/enroll`, { email: s.email });
    if (r.status >= 300) throw new Error(`enroll ${s.email}: ${r.status} ${JSON.stringify(r.body)}`);
  }
  const takeExam = async (s, lang) => {
    const p = await openAs(s, lang, "/student/dashboard", 390);
    await shot(p, `03-dashboard-${lang}`);
    await p.goto(`${APP}/student/assessments/${assessmentId}/take`, { waitUntil: "networkidle0" });
    await p.select("#exam-language", lang);
    await sleep(300);
    await p.evaluate(() => document.querySelector("main button.btn-primary, button.btn-primary")?.click());
    await p.waitForSelector("[role=radio]", { timeout: 90000 });
    const seen = [];
    for (let i = 0; i < 20; i++) {
      await p.waitForSelector("[role=radio]", { timeout: 90000 });
      const stem = await p.evaluate(() => document.querySelector("main h1, main h2")?.innerText || "");
      seen.push(stem);
      if (i === 0) await shot(p, `04-question-${lang}`);
      await p.evaluate((i) => {
        const opts = [...document.querySelectorAll("[role=radio]")];
        opts[i % opts.length].click();
      }, i);
      await sleep(400);
      const last = await p.evaluate(() => {
        const nav = [...document.querySelectorAll("nav button.btn-primary")].at(-1);
        return nav ? nav.innerText : "";
      });
      await p.evaluate(() => [...document.querySelectorAll("nav button.btn-primary")].at(-1)?.click());
      if (/Submit|جمع/.test(last)) {
        await sleep(500);
        await p.evaluate(() => {
          const d = document.querySelector("[role=dialog], [role=alertdialog]");
          if (!d) return;
          const buttons = [...d.querySelectorAll("button")];
          buttons.at(-1)?.click();
        });
        break;
      }
      await p.waitForFunction((prev) => (document.querySelector("main h1, main h2")?.innerText || "") !== prev || !document.querySelector("[role=radio]"), { timeout: 90000 }, stem);
    }
    await p.waitForFunction(() => !document.querySelector("[role=radio]") && /%/.test(document.body.innerText), { timeout: 60000 });
    await shot(p, `05-submitted-${lang}`);
    const attempt = (await db.query("SELECT status, language, raw_percentage, adjusted_percentage FROM assessment_attempts WHERE student_id = $1 AND assessment_id = $2", [s.id, assessmentId])).rows[0];
    const served = (await db.query("SELECT g.language, g.pool_question_id FROM generated_questions g JOIN assessment_attempts a ON a.id = g.attempt_id WHERE a.student_id = $1 AND a.assessment_id = $2", [s.id, assessmentId])).rows;
    step(
      `Student takes the exam in ${lang === "ur" ? "Urdu" : "English"} one question at a time (UI)`,
      attempt?.status === "completed" && served.every((q) => q.language === lang) && served.length === 4,
      `${seen.length} questions answered, attempt ${JSON.stringify(attempt)}, first: "${seen[0]?.slice(0, 80)}"`
    );

    // Results page, study plan, practice, report.
    await p.goto(`${APP}/student/results/${assessmentId}`, { waitUntil: "networkidle0" });
    await shot(p, `06-results-${lang}`);
    const planLabel = lang === "ur" ? null : "Create my study plan";
    if (planLabel) {
      await clickButton(p, planLabel);
      await p.waitForFunction(() => !document.body.innerText.includes("Writing your plan"), { timeout: 120000 });
      await sleep(1000);
      await clickButton(p, "Start practice");
      await p.waitForFunction(() => document.body.innerText.includes("Check answer") || document.body.innerText.includes("could not be prepared"), { timeout: 120000 });
      await shot(p, `07-plan-practice-${lang}`);
    }
    const plan = await api(s, "POST", `/student-analytics/results/${assessmentId}/study-plan`, { language: lang });
    const report = await api(s, "GET", `/student-analytics/results/${assessmentId}/report.pdf?language=${lang}`);
    fs.writeFileSync(path.join(outDir, `report-${lang}.pdf`), report.body);
    const practiceRows = (await db.query("SELECT count(*)::int AS n FROM practice_sessions WHERE student_id = $1", [s.id])).rows[0].n;
    step(
      `Results, AI study plan, practice and PDF report (${lang})`,
      plan.status === 200 && report.status === 200 && report.body.subarray(0, 4).toString() === "%PDF" && practiceRows >= 1,
      `study plan ${plan.status} (source ${plan.body?.data?.source || plan.body?.data?.plan?.source || "?"}), report ${report.status} ${report.body.length} bytes, practice sessions ${practiceRows}`
    );
    await p.close();
    return served.map((q) => q.pool_question_id);
  };
  const setEn = await takeExam(studentEn, "en");
  const setUr = await takeExam(studentUr, "ur");
  step("The two students got different questions", setEn.join() !== setUr.join(), `${setEn.join(",")} vs ${setUr.join(",")}`);

  // ---------------------------------------------------------- 5. instructor views + printing
  page = await openAs(instructor, "en", `/instructor/assessments/${assessmentId}/analytics`);
  await shot(page, "08-analytics");
  const insights = await api(instructor, "GET", `/instructor-analytics/assessment/${assessmentId}/insights`);
  step("Instructor analytics", insights.status === 200 && insights.body.data.summary.students === 2, `students ${insights.body.data?.summary?.students}`);
  await page.goto(`${APP}/instructor/assessments/${assessmentId}/questions`, { waitUntil: "networkidle0" });
  await shot(page, "09-question-bank");
  await page.close();
  const prints = [];
  for (const [mode, format] of [["same", "pdf"], ["unique", "docx"]]) {
    const r = await api(instructor, "POST", `/assessments/${assessmentId}/print`, { language: "ur", mode, copies: 2, format, instituteName: "گورنمنٹ ہائی اسکول", teacherName: "E2E Instructor" });
    fs.writeFileSync(path.join(outDir, `paper-${mode}.${format}`), Buffer.isBuffer(r.body) ? r.body : Buffer.from(JSON.stringify(r.body)));
    prints.push(`${format} ${mode}: ${r.status} ${Buffer.isBuffer(r.body) ? r.body.length : JSON.stringify(r.body)}`);
  }
  step("Printed papers (PDF same, DOCX unique)", prints.every((p) => / 200 /.test(p)), prints.join("\n"));

  // ---------------------------------------------------------- 6. super admin AI usage
  page = await openAs(superAdmin, "en", "/super-admin/dashboard");
  await page.waitForFunction(() => document.body.innerText.includes("API keys today"), { timeout: 30000 });
  await shot(page, "10-superadmin-usage");
  const stats = await api(superAdmin, "GET", "/admin/stats?days=7");
  const keys = stats.body.data.llm.keys;
  const text = await page.evaluate(() => document.body.innerText);
  step(
    "Super admin sees AI usage per key and per day, no cost",
    keys.length > 0 && !/cost|\$/i.test(text) && stats.body.data.llm.today.tokens > 0,
    keys.map((k) => `${k.label} (${k.model}): ${k.today.requests} requests / ${k.limits.rpd ?? "∞"}, ${k.today.tokens} tokens${k.limits.tpd ? ` / ${k.limits.tpd}` : ""}, ${k.status}`).join("\n")
  );
  await page.close();

  // ---------------------------------------------------------- 7. admin scope
  const adminUsers = await api(admin, "GET", "/auth/users");
  step("Admin without a group sees no users (scope fails closed)", adminUsers.status === 200 && adminUsers.body.users.length <= 1, `${adminUsers.body.users?.length} users`);
} catch (error) {
  step("Flow aborted", false, error.stack?.split("\n").slice(0, 4).join("\n"));
}

const usage = (
  await db.query(
    `SELECT purpose, key_label, count(*)::int AS calls, count(*) FILTER (WHERE NOT success)::int AS failed,
            sum(COALESCE(input_tokens,0))::int AS input, sum(COALESCE(output_tokens,0))::int AS output
     FROM llm_usage_log GROUP BY 1, 2 ORDER BY 1, 2`
  )
).rows;
console.log("AI usage:");
for (const u of usage) console.log(`  ${u.purpose} ${u.key_label}: ${u.calls} calls (${u.failed} failed), ${u.input} in / ${u.output} out`);
const errors = (await db.query("SELECT key_label, error FROM llm_usage_log WHERE NOT success LIMIT 5")).rows;
for (const e of errors) console.log(`  error ${e.key_label}: ${String(e.error).replace(/AIza[0-9A-Za-z_-]{20,}/g, "[key]").slice(0, 200)}`);
console.log(`browser errors: ${consoleErrors.length ? `\n  ${[...new Set(consoleErrors)].join("\n  ")}` : "none"}`);
fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify({ results, usage, consoleErrors }, null, 2));
console.log(`E2E ${results.filter((r) => r.pass).length}/${results.length} passed in ${elapsed()}`);
await browser.close();
await db.end();
