/**
 * Final visual + accessibility pass: every page at 360/768/1280 px in English, Urdu, Arabic and
 * Sindhi, with automatic checks on each capture:
 *   horizontal overflow, raw i18n keys or {{placeholders}}, <html dir> for RTL languages,
 *   console errors, and axe-core (WCAG 2 A/AA) violations of impact "serious" or "critical".
 * Needs demoServer.mjs running (API on 127.0.0.1:5056) and the frontend build served on 127.0.0.1:5174.
 *
 *   node shootAll.mjs <backendDir> <outDir> <idsJson> [widths] [languages]
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const [, , backendDirArg, outDirArg, idsJson, widthsArg, langsArg] = process.argv;
const backendDir = path.resolve(backendDirArg);
const outDir = path.resolve(outDirArg);
fs.mkdirSync(outDir, { recursive: true });
const ids = JSON.parse(idsJson);
const require = createRequire(path.join(backendDir, "package.json"));
const puppeteer = require("puppeteer");
const jwt = require("jsonwebtoken");
const axeSource = fs.readFileSync(createRequire(path.join(backendDir, "..", "frontend", "package.json")).resolve("axe-core/axe.min.js"), "utf8");
const APP = "http://127.0.0.1:5174";
const API = "http://127.0.0.1:5056/api";
const WIDTHS = (widthsArg || "360,768,1280").split(",").map(Number);
const LANGS = (langsArg || "en,ur,ar,sd").split(",");
const SECRET = "demo-jwt-secret-not-for-production";
const RTL = ["ur", "ar", "fa", "sd"];

const users = {
  instructor: { id: ids.instructor, email: "instructor@demo.io", role: "instructor", name: "Iqra Instructor" },
  student: { id: ids.students[0], email: "ali@demo.io", role: "student", name: "Ali Raza" },
  examStudent: { id: ids.students[1], email: "sana@demo.io", role: "student", name: "Sana Khan" },
  admin: { id: ids.admin, email: "admin@demo.io", role: "admin", name: "Adam Admin" },
  superAdmin: { id: ids.superAdmin, email: "super@demo.io", role: "super_admin", name: "Sara Super" },
};
const tokenOf = (u) => jwt.sign({ id: u.id, email: u.email, role: u.role }, SECRET);
const call = async (method, p, user, body, headers = {}) => {
  const res = await fetch(`${API}${p}`, {
    method,
    headers: { "content-type": "application/json", ...(user ? { Authorization: `Bearer ${tokenOf(user)}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json().catch(() => ({}));
};

// ------------------------------------------------------------ data for the pages
const A = ids.assessment;
// Ali completes the exam (results page); Sana starts it (exam page).
let current = (await call("POST", `/taking/assessments/${A}/start`, users.student, { language: "en" })).data;
for (let i = 0; current && i < current.totalQuestions; i++) {
  await call("PUT", `/taking/attempts/${current.attemptId}/answers/${current.question.id}`, users.student, { answer: current.question.options?.[0] ?? true });
  const next = (await call("POST", `/taking/attempts/${current.attemptId}/advance`, users.student, { fromIndex: i })).data;
  if (next?.finished) break;
  current = next;
}
await call("POST", `/taking/assessments/${A}/start`, users.examStudent, { language: "ur" });
const live = (await call("POST", "/live/sessions", users.instructor, { source: "bank", assessmentId: A, count: 3, settings: { game: true, teams: 2 } })).data.session;
const guest = (await call("POST", "/live/join", null, { code: live.code, nickname: "Guest Zara" })).data;
await call("POST", `/live/sessions/${live.id}/polls`, users.instructor, { kind: "single", question: "Which topic next?", options: ["Plants", "Animals"] });
await call("POST", `/live/sessions/${live.id}/control`, users.instructor, { action: "start" });

const PAGES = [
  { name: "home", path: "/" },
  { name: "login", path: "/login" },
  { name: "signup", path: "/signup" },
  { name: "join", path: "/join" },
  { name: "terms", path: "/terms" },
  { name: "privacy", path: "/privacy" },
  { name: "live-play-guest", path: `/live/${live.id}`, liveToken: { session: live.id, token: guest.token } },
  { name: "student-dashboard", path: "/student/dashboard", user: "student" },
  { name: "student-results", path: `/student/results/${A}`, user: "student" },
  { name: "student-analytics", path: "/student/analytics", user: "student" },
  { name: "student-exam", path: `/student/assessments/${A}/take`, user: "examStudent" },
  { name: "help", path: "/help", user: "student" },
  { name: "profile", path: "/profile", user: "student" },
  { name: "instructor-dashboard", path: "/instructor/dashboard", user: "instructor" },
  { name: "assessments", path: "/instructor/assessments", user: "instructor" },
  { name: "create-assessment", path: "/instructor/assessments/create", user: "instructor" },
  { name: "assessment-detail", path: `/instructor/assessments/${A}`, user: "instructor" },
  { name: "objectives", path: `/instructor/assessments/${A}/objectives`, user: "instructor" },
  { name: "question-bank", path: `/instructor/assessments/${A}/questions`, user: "instructor" },
  { name: "analytics", path: `/instructor/assessments/${A}/analytics`, user: "instructor" },
  { name: "enroll", path: `/instructor/assessments/${A}/enroll`, user: "instructor" },
  { name: "resources", path: "/instructor/resources", user: "instructor" },
  { name: "live-sessions", path: "/instructor/live", user: "instructor" },
  { name: "live-host", path: `/instructor/live/${live.id}`, user: "instructor" },
  { name: "live-projector", path: `/instructor/live/${live.id}/projector`, user: "instructor" },
  { name: "admin-users", path: "/admin/dashboard", user: "admin" },
  { name: "superadmin-dashboard", path: "/super-admin/dashboard", user: "superAdmin" },
  { name: "superadmin-groups", path: "/super-admin/groups", user: "superAdmin" },
];

// ------------------------------------------------------------------ capture
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const rows = [["page", "language", "width", "overflow_px", "dir_ok", "raw_keys", "console_errors", "axe_serious", "axe_rules"]];
const problems = [];
const RAW_KEY = /\b(live|exam|help|plans|common|errors|nav|home|legal|feedback|examControls|questions|bank|objectives|publish|results|learning|auth|form|analytics|platform|users|groups|resources|detail|review|dashboard|studentDashboard|enroll|paper|status|validation|roles|insights|students|notifications|preview|profile|assessments|questionTypes)\.[a-z][A-Za-z]+(\.[A-Za-z]+)*\b/;

for (const lang of LANGS) {
  for (const width of WIDTHS) {
    for (const page of PAGES) {
      const context = await browser.createBrowserContext();
      const tab = await context.newPage();
      await tab.setViewport({ width, height: 900 });
      const errors = [];
      tab.on("console", (m) => m.type() === "error" && !/favicon|ERR_CONNECTION_REFUSED/.test(m.text()) && errors.push(m.text()));
      tab.on("pageerror", (e) => errors.push(String(e.message)));
      await tab.goto(`${APP}/offline.html`, { waitUntil: "domcontentloaded" });
      const user = page.user ? users[page.user] : null;
      await tab.evaluate(
        (l, token, u, live) => {
          localStorage.setItem("gradix.language", l);
          localStorage.setItem(`gradix.tour.${u?.id}`, "1"); // the tour would cover the page
          if (token) {
            localStorage.setItem("token", token);
            localStorage.setItem("auth-storage", JSON.stringify({ state: { token, user: u }, version: 0 }));
          }
          if (live) localStorage.setItem("gradix.live", JSON.stringify({ [live.session]: live.token }));
        },
        lang,
        user ? tokenOf(user) : null,
        user ? { ...user, language: lang } : null,
        page.liveToken || null
      );
      try {
        await tab.goto(`${APP}${page.path}`, { waitUntil: "networkidle0", timeout: 30000 });
      } catch {
        // a page that keeps a socket open never reaches networkidle0; continue
      }
      await new Promise((r) => setTimeout(r, 600));
      const facts = await tab.evaluate(() => ({
        overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
        dir: document.documentElement.dir,
        text: document.body.innerText,
      }));
      await tab.addScriptTag({ content: axeSource });
      const axe = await tab.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
        return r.violations.filter((v) => ["serious", "critical"].includes(v.impact)).map((v) => ({ id: v.id, nodes: v.nodes.length, target: v.nodes[0]?.target?.join(" ") }));
      });
      const raw = (facts.text.match(RAW_KEY) || [])[0] || (facts.text.includes("{{") ? "{{" : "");
      const dirOk = RTL.includes(lang) ? facts.dir === "rtl" : facts.dir !== "rtl";
      await tab.screenshot({ path: path.join(outDir, `${page.name}-${lang}-${width}.png`) });
      rows.push([page.name, lang, width, facts.overflow, dirOk, raw, errors.length, axe.reduce((s, v) => s + v.nodes, 0), axe.map((v) => v.id).join(" ")]);
      if (facts.overflow > 1 || !dirOk || raw || errors.length || axe.length) {
        problems.push({ page: page.name, lang, width, overflow: facts.overflow, dirOk, raw, errors: errors.slice(0, 2), axe });
      }
      await context.close();
    }
    console.log(`${lang} ${width}: done (${problems.length} problems so far)`);
  }
}
await browser.close();
fs.writeFileSync(path.join(outDir, "checks.csv"), rows.map((r) => r.join(",")).join("\n") + "\n");
fs.writeFileSync(path.join(outDir, "problems.json"), JSON.stringify(problems, null, 2));
console.log(`${rows.length - 1} captures, ${problems.length} with problems`);
