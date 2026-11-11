/**
 * Browser check: fill-in-the-blank, matching and an image question in a graded exam (Urdu RTL),
 * the review screen, PDF/DOCX papers; proctoring auto-submit at its limit; an exam outside its
 * window cannot start; extra time is applied.
 * Needs demoServer.mjs (API 127.0.0.1:5056) and the frontend build on 127.0.0.1:5174.
 *   node typesFlow.mjs <backendDir> <outDir> <idsJson>
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const [, , backendDirArg, outDirArg, idsJson] = process.argv;
const backendDir = path.resolve(backendDirArg);
const outDir = path.resolve(outDirArg);
fs.mkdirSync(outDir, { recursive: true });
const ids = JSON.parse(idsJson);
const require = createRequire(path.join(backendDir, "package.json"));
const puppeteer = require("puppeteer");
const jwt = require("jsonwebtoken");
const { createCanvas } = require("@napi-rs/canvas");
const APP = "http://127.0.0.1:5174";
const API = "http://127.0.0.1:5056/api";
const SECRET = "demo-jwt-secret-not-for-production";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = "") => {
  results.push(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` - ${detail}` : ""}`);
  console.log(results.at(-1));
};
const teacher = { id: ids.instructor, email: "instructor@demo.io", role: "instructor", name: "Iqra Instructor" };
const tok = (u) => jwt.sign({ id: u.id, email: u.email, role: u.role }, SECRET);
const api = async (method, p, user, body, binary = false) => {
  const res = await fetch(`${API}${p}`, { method, headers: { "content-type": "application/json", Authorization: `Bearer ${tok(user)}` }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: binary ? Buffer.from(await res.arrayBuffer()) : await res.json().catch(() => ({})) };
};
const newStudent = async (name, email, assessment) => {
  // Students are created through the API (register-student) and enrolled by email.
  const reg = await api("POST", "/auth/register-student", teacher, { name, email, password: "Passw0rdGood", language: "ur" });
  const id = reg.body.data?.id ?? reg.body.user?.id ?? reg.body.data?.user?.id;
  await api("POST", `/assessments/${assessment}/enroll`, teacher, { email });
  return { id, email, role: "student", name };
};

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
try {
  // 1. Assessment with fill-in-the-blank + matching + MCQ (the fake AI writes all three).
  const form = new FormData();
  form.append("title", "Types check");
  form.append("prompt", "How plants make food");
  form.append(
    "question_blocks",
    JSON.stringify([
      { question_type: "fill_blank", question_count: 1, duration_per_question: 60, positive_marks: 2, negative_marks: 0 },
      { question_type: "matching", question_count: 1, duration_per_question: 90, num_options: 4, positive_marks: 2, negative_marks: 0 },
      { question_type: "multiple_choice", question_count: 1, duration_per_question: 60, num_options: 4, positive_marks: 1, negative_marks: 0 },
    ])
  );
  form.append("files", new Blob([Array.from({ length: 40 }, (_, i) => `Fact ${i}: plants make sugar from light and water in their leaves.`).join(" ")], { type: "text/plain" }), "lesson.txt");
  const created = await (await fetch(`${API}/assessments`, { method: "POST", headers: { Authorization: `Bearer ${tok(teacher)}` }, body: form })).json();
  const A = created.data.id;
  await api("POST", `/assessments/${A}/publish`, teacher, { languages: ["ur"], allowUncoveredObjectives: true });

  // An image on every MCQ in the pool (uploaded through the API, with alt text).
  const canvas = createCanvas(600, 300);
  const g = canvas.getContext("2d");
  g.fillStyle = "#2e7d32";
  g.fillRect(0, 0, 600, 300);
  g.fillStyle = "#fff";
  g.font = "bold 48px sans-serif";
  g.fillText("LEAF", 220, 170);
  const up = new FormData();
  up.append("image", new Blob([canvas.toBuffer("image/png")], { type: "image/png" }), "leaf.png");
  const image = (await (await fetch(`${API}/assessments/${A}/question-images`, { method: "POST", headers: { Authorization: `Bearer ${tok(teacher)}` }, body: up })).json()).data;
  check("image uploaded and compressed to WebP", Boolean(image?.key?.endsWith(".webp")), `${image?.width}x${image?.height}`);
  const bank = await api("GET", `/assessments/${A}/questions?language=ur&pageSize=100`, teacher);
  const mcqs = (bank.body.data?.items || []).filter((q) => q.questionType === "multiple_choice");
  for (const q of mcqs.slice(0, 40)) {
    await api("PUT", `/assessments/${A}/questions/${q.id}`, teacher, { question_text: q.questionText, options: q.options, correct_answer: q.correctAnswer, image: { key: image.key, alt: "ایک سبز پتا" } });
  }

  // 2. Student takes the exam in the browser (Urdu UI).
  const ali = await newStudent("علی", "types-ali@demo.io", A);
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 400, height: 860 });
  await page.goto(`${APP}/offline.html`);
  await page.evaluate((t, u) => {
    localStorage.setItem("gradix.language", "ur");
    localStorage.setItem(`gradix.tour.${u.id}`, "1");
    localStorage.setItem("token", t);
    localStorage.setItem("auth-storage", JSON.stringify({ state: { token: t, user: { ...u, language: "ur" } }, version: 0 }));
  }, tok(ali), ali);
  await page.goto(`${APP}/student/assessments/${A}/take`, { waitUntil: "networkidle0" });
  await sleep(800);
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.className.includes("btn-primary"))?.click());
  const seen = new Set();
  for (let i = 0; i < 3; i++) {
    await page.waitForFunction(() => document.querySelector("[role=radiogroup], input[aria-label], select"), { timeout: 20000 });
    await sleep(500);
    const kind = await page.evaluate(() => (document.querySelector("select[id^=match-]") ? "matching" : document.querySelector("p input[type=text]") ? "fill_blank" : "multiple_choice"));
    seen.add(kind);
    await page.screenshot({ path: path.join(outDir, `t-exam-${kind}-ur.png`) });
    if (kind === "fill_blank") {
      for (const input of await page.$$("p input[type=text]")) await input.type("پہلا");
    } else if (kind === "matching") {
      for (const sel of await page.$$("select[id^=match-]")) await sel.evaluate((s) => ((s.value = s.options[1].value), s.dispatchEvent(new Event("change", { bubbles: true }))));
    } else {
      const hasImage = await page.evaluate(() => Boolean(document.querySelector('img[alt="ایک سبز پتا"]')));
      check("the MCQ shows its image with alt text to the student", hasImage);
      await (await page.$$("[role=radio]"))[0].click();
    }
    await sleep(1200);
    await page.evaluate(() => [...document.querySelectorAll("button")].filter((b) => b.className.includes("btn-primary")).at(-1)?.click());
    await sleep(1500);
    const modal = await page.$("[role=dialog] .btn-primary");
    if (modal) await modal.click();
    await sleep(1500);
  }
  check("fill-in-the-blank, matching and MCQ all appear in the exam", seen.size === 3, [...seen].join(", "));

  const results1 = await api("GET", `/student-analytics/results/${A}`, ali);
  const review = results1.body.data?.review || [];
  check("review lists the structured answers and readable correct answers", review.some((r) => r.question_type === "matching" && r.correct_answer_text?.includes("→")) && review.some((r) => r.question_type === "fill_blank" && r.correct_answer_text));
  await page.goto(`${APP}/student/results/${A}`, { waitUntil: "networkidle0" });
  await sleep(800);
  await page.screenshot({ path: path.join(outDir, "t-results-review-ur.png"), fullPage: false });
  await context.close();

  // 3. Papers: PDF and DOCX in Urdu with the new types and images.
  const pdf = await api("POST", `/assessments/${A}/print`, teacher, { language: "ur", instituteName: "گورنمنٹ ہائی اسکول", mode: "unique", copies: 2 }, true);
  const docx = await api("POST", `/assessments/${A}/print`, teacher, { language: "ur", format: "docx", instituteName: "گورنمنٹ ہائی اسکول", mode: "unique", copies: 2 }, true);
  fs.writeFileSync(path.join(outDir, "t-paper-ur.pdf"), pdf.body);
  fs.writeFileSync(path.join(outDir, "t-paper-ur.docx"), docx.body);
  check("PDF paper (Urdu) prints", pdf.status === 200 && pdf.body.slice(0, 4).toString() === "%PDF", `${Math.round(pdf.body.length / 1024)} KB`);
  check("DOCX paper (Urdu) prints with images", docx.status === 200 && docx.body.includes(Buffer.from("word/media/")), `${Math.round(docx.body.length / 1024)} KB`);

  // 4. Proctoring: warn + auto-submit after 2 events; the browser reports leaving the window.
  await api("PUT", `/assessments/${A}/exam-settings`, teacher, { proctoring: "auto_submit", maxViolations: 2 });
  const sana = await newStudent("ثنا", "types-sana@demo.io", A);
  const c2 = await browser.createBrowserContext();
  const p2 = await c2.newPage();
  await p2.setViewport({ width: 400, height: 860 });
  await p2.goto(`${APP}/offline.html`);
  await p2.evaluate((t, u) => {
    localStorage.setItem("gradix.language", "ur");
    localStorage.setItem(`gradix.tour.${u.id}`, "1");
    localStorage.setItem("token", t);
    localStorage.setItem("auth-storage", JSON.stringify({ state: { token: t, user: { ...u, language: "ur" } }, version: 0 }));
  }, tok(sana), sana);
  await p2.goto(`${APP}/student/assessments/${A}/take`, { waitUntil: "networkidle0" });
  await sleep(800);
  await p2.screenshot({ path: path.join(outDir, "t-proctoring-consent-ur.png") });
  const consent = await p2.$('input[type="checkbox"]');
  check("the pre-exam screen asks for consent to monitoring", Boolean(consent));
  await consent.click();
  await p2.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.className.includes("btn-primary"))?.click());
  await p2.waitForFunction(() => document.querySelector("[role=radiogroup], input[aria-label], select"), { timeout: 20000 });
  await p2.evaluate(() => window.dispatchEvent(new Event("blur")));
  await sleep(1200);
  await p2.screenshot({ path: path.join(outDir, "t-proctoring-warning-ur.png") });
  const warned = await p2.evaluate(() => Boolean(document.querySelector('[role="alert"]')));
  check("leaving the window is recorded and the student is warned", warned);
  await p2.evaluate(() => document.dispatchEvent(new ClipboardEvent("copy", { bubbles: true, cancelable: true })));
  await sleep(2500);
  const attempt = (await api("GET", `/assessments/${A}/attempts/0/integrity`, teacher)).body;
  void attempt;
  const list = await api("GET", `/instructor-analytics/assessment/${A}/students`, teacher);
  const row = (list.body.data || []).find((s) => s.student_id === sana.id);
  check("at the limit (2 events) the exam is auto-submitted and the teacher sees it", row?.violation_count === 2 && row?.auto_submitted_reason === "proctoring", JSON.stringify(row ? { v: row.violation_count, r: row.auto_submitted_reason } : null));
  if (row?.attempt_id) {
    const timeline = await api("GET", `/assessments/${A}/attempts/${row.attempt_id}/integrity`, teacher);
    check("integrity timeline lists the events with times", timeline.body.data?.events?.map((e) => e.kind).join(",") === "window_blur,copy");
  }
  await c2.close();

  // 5. Window and extra time.
  await api("PUT", `/assessments/${A}/exam-settings`, teacher, { proctoring: "off", windowStart: new Date(Date.now() + 3600e3).toISOString() });
  const late = await newStudent("عمر", "types-omar@demo.io", A);
  const blocked = await api("POST", `/taking/assessments/${A}/start`, late, { language: "ur" });
  check("an exam outside its window cannot be started", blocked.body.code === "EXAM_NOT_OPEN");
  await api("PUT", `/assessments/${A}/exam-settings`, teacher, { windowStart: null });
  await api("PUT", `/assessments/${A}/enrollments/${late.id}/extra-time`, teacher, { extraTime: 1.5 });
  const started = await api("POST", `/taking/assessments/${A}/start`, late, { language: "ur" });
  const q = started.body.data?.question;
  check("extra time is applied by the server", q && [90, 135].includes(q.duration_per_question), `${q?.question_type}: ${q?.duration_per_question} s`);
} catch (error) {
  check("flow completed", false, error.message);
} finally {
  await browser.close();
  fs.writeFileSync(path.join(outDir, "typesFlow.log"), `${results.join("\n")}\n`);
  console.log(`\n${results.filter((r) => r.startsWith("PASS")).length}/${results.length} checks passed`);
}
