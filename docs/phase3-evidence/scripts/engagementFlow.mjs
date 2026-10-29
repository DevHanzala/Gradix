/**
 * Engagement end-to-end in real browsers: a game-mode session with 2 teams; the teacher launches a
 * quick poll and an exit ticket from the board; three students (one in Urdu, one guest) answer; the
 * board and projector update; the team race moves; the session ends on a podium.
 *
 *   node engagementFlow.mjs <backendDir> <outDir>     (frontend preview + PG* env as for liveFlow.mjs)
 */
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const backendDir = path.resolve(process.argv[2]);
const outDir = path.resolve(process.argv[3]);
fs.mkdirSync(outDir, { recursive: true });
const require = createRequire(path.join(backendDir, "package.json"));
const puppeteer = require("puppeteer");
const jwt = require("jsonwebtoken");
const APP = process.env.APP || "http://127.0.0.1:5174";
const API = process.env.API || "http://127.0.0.1:5056";
const here = path.dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const log = [];
const note = (m) => {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${m}`;
  log.push(line);
  console.log(line);
};
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  note(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` - ${detail}` : ""}`);
};

const server = spawn(process.execPath, [path.join(here, "demoServer.mjs"), backendDir, new URL(API).port], {
  env: { ...process.env, DEMO_FRONTEND_URL: APP },
  stdio: ["ignore", "pipe", "pipe"],
});
const ids = await new Promise((resolve, reject) => {
  let buffer = "";
  server.stdout.on("data", (d) => {
    fs.appendFileSync(path.join(outDir, "demoServer.log"), d);
    buffer += d;
    const m = buffer.match(/DEMO READY \d+ (.*)/);
    if (m) resolve(JSON.parse(m[1]));
  });
  server.stderr.on("data", (d) => fs.appendFileSync(path.join(outDir, "demoServer.log"), d));
  server.on("exit", (code) => reject(new Error(`demo server exited ${code}`)));
});

const SECRET = "demo-jwt-secret-not-for-production";
const teacherUser = { id: ids.instructor, email: "instructor@demo.io", role: "instructor", name: "Iqra Instructor" };
const ali = { id: ids.students[0], email: "ali@demo.io", role: "student", name: "Ali Raza" };
const sana = { id: ids.students[1], email: "sana@demo.io", role: "student", name: "Sana Khan" };
const tokenOf = (u) => jwt.sign({ id: u.id, email: u.email, role: u.role }, SECRET);
const api = (p, body, method = "POST") =>
  fetch(`${API}/api${p}`, {
    method,
    headers: { "content-type": "application/json", Authorization: `Bearer ${tokenOf(teacherUser)}` },
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => r.json());

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const consoleErrors = [];
const open = async (label, user, { width = 1280, height = 900, language = "en" } = {}) => {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width, height });
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(`${label}: ${m.text()}`));
  await page.goto(`${APP}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    (token, u, lang) => {
      localStorage.setItem("gradix.language", lang);
      if (token) {
        localStorage.setItem("token", token);
        localStorage.setItem("auth-storage", JSON.stringify({ state: { token, user: u }, version: 0 }));
      }
    },
    user ? tokenOf(user) : null,
    user ? { ...user, language } : null,
    language
  );
  return { page, label };
};
const text = (p) => p.page.evaluate(() => document.body.innerText);
const waitText = async (p, re, timeout = 8000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (re.test(await text(p))) return Date.now() - start;
    await sleep(100);
  }
  throw new Error(`${p.label}: "${re}" not shown within ${timeout} ms`);
};
const clickText = async (p, re, timeout = 8000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    for (const h of await p.page.$$("button, a, label")) {
      const [t, disabled] = await h.evaluate((el) => [el.innerText.trim(), el.disabled]);
      if (re.test(t) && !disabled) return h.click();
    }
    await sleep(100);
  }
  throw new Error(`${p.label}: nothing clickable matches ${re}`);
};
const shot = (p, name) => p.page.screenshot({ path: path.join(outDir, `${name}.png`) });

try {
  const created = await api("/live/sessions", {
    source: "bank",
    assessmentId: ids.assessment,
    language: "ur",
    count: 2,
    secondsPerQuestion: 30,
    settings: { game: true, teams: 2, sounds: true },
  });
  const { id, code } = created.data.session;
  note(`session ${id} code ${code} (Urdu questions, game, 2 teams)`);

  const teacher = await open("teacher", teacherUser);
  await teacher.page.goto(`${APP}/instructor/live/${id}`, { waitUntil: "networkidle0" });
  const s1 = await open("ali", ali, { width: 360, height: 780 });
  const s2 = await open("sana-ur", sana, { width: 360, height: 780, language: "ur" });
  const s3 = await open("guest", null, { width: 360, height: 780 });
  for (const s of [s1, s2, s3]) await s.page.goto(`${APP}/join/${code}`, { waitUntil: "networkidle0" });
  await s3.page.type('input[autocomplete="nickname"]', "Guest Zara");
  await clickText(s1, /^Join$/);
  await clickText(s2, /^شامل ہوں$/);
  await clickText(s3, /^Join$/);
  await waitText(s2, /شامل ہو گئے/);
  check("Urdu student screen is right-to-left", (await s2.page.evaluate(() => document.documentElement.dir)) === "rtl");
  await waitText(teacher, /Guest Zara/);
  check("teams are assigned on join", /Team 1/.test(await text(teacher)) && /Team 2/.test(await text(teacher)));

  // Quick poll from the board.
  await teacher.page.type('input[maxlength="300"]', "Which topic should we revise?");
  const optionInputs = await teacher.page.$$('input[maxlength="120"]');
  await optionInputs[0].type("Photosynthesis");
  await optionInputs[1].type("Respiration");
  await clickText(teacher, /^Launch poll$/);
  const pollMs = await waitText(s1, /Which topic should we revise\?/);
  await waitText(s2, /Which topic should we revise\?/);
  check("a poll launched by the teacher appears on every phone", true, `${pollMs} ms`);
  await shot(s2, "e01-poll-urdu-student");
  await clickText(s1, /^Photosynthesis$/);
  await clickText(s1, /^Send$/);
  await clickText(s2, /^Photosynthesis$/);
  await clickText(s2, /^بھیجیں$/);
  await clickText(s3, /^Respiration$/);
  await clickText(s3, /^Send$/);
  await waitText(s1, /Thanks! Your answer was sent/);
  const tallyMs = await waitText(teacher, /Responses: 3/);
  const board = await text(teacher);
  check("poll results update live on the board", /2 · 67%/.test(board) && /1 · 33%/.test(board), `after ${tallyMs} ms`);
  await shot(teacher, "e02-poll-results-board");

  // Exit ticket from the board.
  const pollType = await teacher.page.$('select:has(option[value="exit_ticket"])');
  await pollType.select("exit_ticket");
  await clickText(teacher, /^Launch exit ticket$/);
  await waitText(s1, /آج کا سبق آپ کو کتنا سمجھ آیا/);
  await waitText(s2, /آج کا سبق آپ کو کتنا سمجھ آیا/);
  // The session language is Urdu, so the exit ticket prompts are in Urdu on every phone.
  check("exit ticket appears with its three prompts", true);
  for (const [s, score, learned, question] of [
    [s1, "4", "Leaves make sugar", "Why are leaves green?"],
    [s2, "3", "سورج کی روشنی ضروری ہے", ""],
    [s3, "5", "Chlorophyll absorbs light", ""],
  ]) {
    const buttons = await s.page.$$('[role="radio"]');
    for (const b of buttons) if ((await b.evaluate((el) => el.innerText.trim())) === score) await b.click();
    const areas = await s.page.$$("textarea");
    await areas[0].type(learned);
    if (question) await areas[1].type(question);
    const send = (await s.page.$$("button[type=submit]")).at(-1);
    await send.click();
  }
  await waitText(teacher, /Chlorophyll absorbs light/);
  await waitText(teacher, /سورج/); // the Urdu answer has arrived too
  const exitBoard = await text(teacher);
  check("exit ticket summary: average, what was learned, questions", /Average understanding: 4 \/ 5/.test(exitBoard) && /Leaves make sugar/.test(exitBoard) && /Why are leaves green\?/.test(exitBoard) && /سورج کی روشنی/.test(exitBoard));
  await shot(teacher, "e03-exit-ticket-summary");

  // Game with team race and podium.
  await clickText(teacher, /^Close$/).catch(() => {});
  await clickText(teacher, /^Start$/);
  await waitText(s1, /Question 1 of 2/);
  for (const s of [s1, s2, s3]) {
    await (await s.page.$$('[role="radio"]'))[0].click();
  }
  await waitText(teacher, /3 \/ 3/);
  await clickText(teacher, /^Show answer$/);
  await waitText(s1, /Correct!|Not this time/);
  check("team race is shown to students", /Team race/.test(await text(s1)));
  await shot(s1, "e04-student-reveal-team-race");
  const projector = await open("projector", teacherUser, { width: 1280, height: 800 });
  await projector.page.goto(`${APP}/instructor/live/${id}/projector`, { waitUntil: "networkidle0" });
  await waitText(projector, /Team race/);
  await shot(projector, "e05-projector-team-race");
  await clickText(teacher, /^Next question$/);
  await waitText(s1, /Question 2 of 2/);
  for (const s of [s1, s2, s3]) await (await s.page.$$('[role="radio"]'))[1].click();
  await waitText(teacher, /3 \/ 3/);
  await clickText(teacher, /^Show answer$/);
  await clickText(teacher, /^Finish$/);
  await waitText(projector, /Podium/);
  await waitText(s1, /Podium/);
  check("game ends on a podium (projector and phones)", true);
  await shot(projector, "e06-projector-podium");
  await shot(s2, "e07-urdu-student-podium");
} catch (error) {
  check("flow completed", false, error.message);
} finally {
  check("no console errors", consoleErrors.length === 0, consoleErrors.slice(0, 4).join(" | "));
  await browser.close();
  server.kill("SIGTERM");
  fs.writeFileSync(path.join(outDir, "engagementFlow.log"), `${log.join("\n")}\n`);
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
}
