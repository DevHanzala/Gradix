/**
 * Live classroom end-to-end in real browsers (Puppeteer), against demoServer.mjs and a
 * production build of the frontend:
 *   teacher creates a game-mode session in the UI -> 2 students with accounts + 1 guest join
 *   by code -> teacher starts -> students answer -> the board updates over Socket.IO ->
 *   answers appear only at reveal -> a student reloads and resumes -> the backend restarts
 *   and the session continues -> leaderboard -> end -> CSV export.
 *
 *   node liveFlow.mjs <backendDir> <outDir>
 * Env: APP (frontend origin, default http://127.0.0.1:5174), API (default http://127.0.0.1:5056),
 *      RESTART_CMD is not used; the script restarts demoServer.mjs itself (PG* env inherited).
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

const log = [];
const results = [];
const note = (msg) => {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
  log.push(line);
  console.log(line);
};
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  note(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` - ${detail}` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- backend
let server;
let serverRuns = 0;
const startServer = (resume) =>
  new Promise((resolve, reject) => {
    serverRuns += 1;
    const logFile = path.join(outDir, `demoServer-${serverRuns}.log`);
    server = spawn(process.execPath, [path.join(here, "demoServer.mjs"), backendDir, new URL(API).port, ...(resume ? ["--resume"] : [])], {
      env: { ...process.env, DEMO_FRONTEND_URL: APP },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let ready = false;
    let buffer = "";
    // Keep reading the child's output for its whole life (a full pipe would block it).
    server.stdout.on("data", (d) => {
      fs.appendFileSync(logFile, d);
      if (ready) return;
      buffer += d;
      const m = buffer.match(/DEMO READY \d+ (.*)/);
      if (m) {
        ready = true;
        resolve(JSON.parse(m[1]));
      }
    });
    server.stderr.on("data", (d) => fs.appendFileSync(logFile, d));
    server.on("exit", (code, signal) => {
      note(`demo server ${serverRuns} exited (code ${code}, signal ${signal})`);
      if (!ready) reject(new Error(`demo server exited before it was ready: ${buffer.slice(-500)}`));
    });
  });
const stopServer = () =>
  new Promise((resolve) => {
    const child = server;
    if (!child || child.exitCode !== null || child.signalCode !== null) return resolve();
    const force = setTimeout(() => child.kill("SIGKILL"), 3000);
    child.once("exit", () => {
      clearTimeout(force);
      resolve();
    });
    child.kill("SIGTERM");
  });

// ---------------------------------------------------------------- browser
const ids = await startServer(false);
note(`demo server up: ${JSON.stringify(ids)}`);
const SECRET = "demo-jwt-secret-not-for-production";
const users = {
  teacher: { id: ids.instructor, email: "instructor@demo.io", role: "instructor", name: "Iqra Instructor" },
  ali: { id: ids.students[0], email: "ali@demo.io", role: "student", name: "Ali Raza" },
  sana: { id: ids.students[1], email: "sana@demo.io", role: "student", name: "Sana Khan" },
};
const tokenOf = (u) => jwt.sign({ id: u.id, email: u.email, role: u.role }, SECRET);

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const consoleErrors = [];
let backendDown = false;
const open = async (label, user, { width = 1280, height = 900 } = {}) => {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width, height });
  page.on("console", (m) => {
    // While the backend is deliberately down, refused socket reconnects are expected.
    if (m.type() !== "error" || (backendDown && /ERR_CONNECTION_REFUSED|WebSocket connection/.test(m.text()))) return;
    consoleErrors.push(`${label}: ${m.text()}`);
  });
  await page.goto(`${APP}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    (token, user) => {
      localStorage.setItem("gradix.language", "en");
      if (token) {
        localStorage.setItem("token", token);
        localStorage.setItem("auth-storage", JSON.stringify({ state: { token, user }, version: 0 }));
      }
    },
    user ? tokenOf(user) : null,
    user ? { id: user.id, email: user.email, role: user.role, name: user.name, language: "en" } : null
  );
  return { page, context, label };
};
const shot = (p, name) => p.page.screenshot({ path: path.join(outDir, `${name}.png`) });
const textOf = (p) => p.page.evaluate(() => document.body.innerText);
const waitText = async (p, re, timeout = 8000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (re.test(await textOf(p))) return Date.now() - start;
    await sleep(100);
  }
  throw new Error(`${p.label}: "${re}" did not appear within ${timeout} ms`);
};
/** Click the first enabled button/link whose text matches, waiting up to 8 s for it to appear. */
const clickText = async (p, re, timeout = 8000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    for (const h of await p.page.$$("button, a")) {
      const [t, disabled] = await h.evaluate((el) => [el.innerText.trim(), el.disabled]);
      if (re.test(t) && !disabled) {
        await h.click();
        return;
      }
    }
    await sleep(100);
  }
  throw new Error(`${p.label}: no enabled button ${re}`);
};

try {
  // 1. Teacher creates a game-mode session through the form.
  const teacher = await open("teacher", users.teacher);
  await teacher.page.goto(`${APP}/instructor/live`, { waitUntil: "networkidle0" });
  await waitText(teacher, /New live session/);
  const numbers = await teacher.page.$$('input[type="number"]');
  const replace = async (el, value) => {
    await el.click();
    await teacher.page.keyboard.down("Control");
    await teacher.page.keyboard.press("A");
    await teacher.page.keyboard.up("Control");
    await el.type(value);
  };
  await replace(numbers[0], "3");
  await replace(numbers[1], "20");
  const game = await teacher.page.$$('input[type="checkbox"]');
  await game[0].click();
  await shot(teacher, "01-teacher-new-session");
  await clickText(teacher, /^Create session$/);
  await teacher.page.waitForFunction(() => /\/instructor\/live\/\d+$/.test(location.pathname), { timeout: 10000 });
  const sessionId = Number(teacher.page.url().split("/").pop());
  await waitText(teacher, /Code/);
  const code = await teacher.page.evaluate(() => [...document.querySelectorAll("p")].map((p) => p.innerText.trim()).find((t) => /^\d{6}$/.test(t)));
  check("teacher creates a session in the UI and gets a 6-digit code", /^\d{6}$/.test(code || ""), `session ${sessionId}, code ${code}`);
  check("QR code is shown", Boolean(await teacher.page.$('img[alt*="QR"]')));
  await shot(teacher, "02-teacher-lobby");

  // 2. Two account holders and one guest join by code (phones: 360 px).
  const ali = await open("ali", users.ali, { width: 360, height: 740 });
  const sana = await open("sana", users.sana, { width: 360, height: 740 });
  const guest = await open("guest", null, { width: 360, height: 740 });
  for (const s of [ali, sana, guest]) {
    await s.page.goto(`${APP}/join/${code}`, { waitUntil: "networkidle0" });
    await waitText(s, /Photosynthesis quiz/);
  }
  await shot(guest, "03-guest-join");
  await guest.page.type('input[autocomplete="nickname"]', "Guest Zara");
  for (const s of [ali, sana, guest]) {
    await clickText(s, /^Join$/);
    await waitText(s, /You're in/);
  }
  await shot(ali, "04-student-lobby");
  const joinedMs = await waitText(teacher, /Guest Zara/);
  check("3 participants join (2 accounts, 1 guest); the board shows them live", true, `guest visible after ${joinedMs} ms`);

  // 3. Start: everyone gets question 1 over the socket.
  await clickText(teacher, /^Start$/);
  const t0 = Date.now();
  for (const s of [ali, sana, guest]) await waitText(s, /Question 1 of 3/);
  check("start reaches every student's screen", true, `${Date.now() - t0} ms for all 3`);
  const before = await textOf(ali);
  check("no correct answer on the student's screen before reveal", !/Correct answer/i.test(before));
  await shot(ali, "05-student-question");

  // Answers: Ali and the guest pick the first option, Sana the second.
  const pick = async (s, i) => (await s.page.$$('[role="radio"]'))[i].click();
  await pick(ali, 0);
  await waitText(ali, /Answer received/);
  await pick(guest, 0);
  await pick(sana, 1);
  const boardMs = await waitText(teacher, /3 \/ 3/);
  check("teacher board updates as answers arrive (Socket.IO)", true, `3 / 3 after ${boardMs} ms`);
  check("answers stay hidden until reveal", !/Correct!|Not this time/.test(await textOf(sana)));
  await shot(teacher, "06-teacher-board-answers");

  // 4. Reveal.
  await clickText(teacher, /^Show answer$/);
  await waitText(ali, /Correct!|Not this time/);
  await waitText(sana, /Correct!|Not this time/);
  check("reveal shows each student their result", true);
  check("game mode: leaderboard between questions", /Leaderboard/.test(await textOf(ali)));
  await shot(ali, "07-student-reveal");

  // 5. A student reloads mid-session and resumes on the same question.
  await sana.page.reload({ waitUntil: "networkidle0" });
  await waitText(sana, /Question 1 of 3/);
  check("a student who reloads resumes where they were", true);

  // 6. The backend restarts; the session continues from the database.
  backendDown = true;
  await stopServer();
  note("backend stopped");
  await sleep(1500);
  await startServer(true);
  note("backend restarted (--resume)");
  await sleep(2000);
  backendDown = false;
  await clickText(teacher, /^Next question$/);
  for (const s of [ali, sana, guest]) await waitText(s, /Question 2 of 3/, 15000);
  check("after a backend restart the session continues; sockets reconnect", true);
  await pick(ali, 0);
  await pick(sana, 0);
  await pick(guest, 1);
  await waitText(teacher, /3 \/ 3/);
  await clickText(teacher, /^Show answer$/);
  await waitText(guest, /Correct!|Not this time/);

  // 7. Projector view.
  const projector = await open("projector", users.teacher, { width: 1280, height: 720 });
  await projector.page.goto(`${APP}/instructor/live/${sessionId}/projector`, { waitUntil: "networkidle0" });
  await waitText(projector, /Question 2 of 3/);
  await shot(projector, "08-projector-reveal");

  // 8. Last question, end, results and CSV.
  await clickText(teacher, /^Next question$/);
  await waitText(ali, /Question 3 of 3/);
  await clickText(teacher, /^Show answer$/);
  await clickText(teacher, /^Finish$/);
  for (const s of [ali, sana, guest]) await waitText(s, /The session has ended/);
  check("ending the session reaches every student", true);
  await shot(guest, "09-guest-ended");
  await shot(teacher, "10-teacher-results");
  const csv = await fetch(`${API}/api/live/sessions/${sessionId}/export.csv`, { headers: { Authorization: `Bearer ${tokenOf(users.teacher)}` } }).then((r) => r.text());
  fs.writeFileSync(path.join(outDir, "export.csv"), csv);
  check("CSV export: 3 participants x 3 questions", csv.trim().split("\n").length === 1 + 9, `${csv.trim().split("\n").length - 1} rows`);
} catch (error) {
  check("flow completed", false, error.message);
} finally {
  check("no console errors", consoleErrors.length === 0, consoleErrors.slice(0, 5).join(" | "));
  await browser.close();
  await stopServer().catch(() => {});
  fs.writeFileSync(path.join(outDir, "liveFlow.log"), `${log.join("\n")}\n`);
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
}
