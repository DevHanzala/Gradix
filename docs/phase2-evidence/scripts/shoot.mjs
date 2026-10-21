/**
 * Screenshots of the Phase 2 pages at 360/768/1280 in en and ur, with automatic checks:
 * horizontal page overflow, elements outside the viewport, document direction, raw
 * i18n keys, page/console errors and failed API calls. Writes report.json.
 * Usage: node shoot.mjs <rootDir> <outDir> [en,ur]
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const [rootDir, outDir, langArg = "en,ur"] = process.argv.slice(2);
const require = createRequire(path.join(rootDir, "package.json"));
const puppeteer = require("puppeteer");
const APP = "http://localhost:5174";
const API = "http://localhost:5055/api";
const WIDTHS = [360, 768, 1280];
const ids = { examId: 1, liveId: 2 };

const PAGES = [
  { name: "instructor-resources", email: "instructor@demo.io", url: "/instructor/resources" },
  { name: "instructor-create", email: "instructor@demo.io", url: "/instructor/assessments/create" },
  { name: "instructor-detail", email: "instructor@demo.io", url: `/instructor/assessments/${ids.examId}` },
  { name: "instructor-print", email: "instructor@demo.io", url: `/instructor/assessments/${ids.examId}`, action: "print" },
  { name: "instructor-objectives", email: "instructor@demo.io", url: `/instructor/assessments/${ids.examId}/objectives` },
  { name: "instructor-bank", email: "instructor@demo.io", url: `/instructor/assessments/${ids.examId}/questions` },
  { name: "instructor-analytics", email: "instructor@demo.io", url: `/instructor/assessments/${ids.examId}/analytics` },
  { name: "instructor-enroll", email: "instructor@demo.io", url: `/instructor/assessments/${ids.examId}/enroll` },
  { name: "student-dashboard", email: "student@demo.io", url: "/student/dashboard" },
  { name: "student-notifications", email: "student@demo.io", url: "/student/dashboard", action: "bell" },
  { name: "student-take", email: "take-{lang}@demo.io", startLive: true, url: `/student/assessments/${ids.liveId}/take` },
  { name: "student-results", email: "student@demo.io", url: `/student/results/${ids.examId}` },
  { name: "admin-groups", email: "admin@demo.io", url: "/admin/groups" },
  { name: "superadmin-dashboard", email: "super@demo.io", url: "/super-admin/dashboard" },
  { name: "superadmin-groups", email: "super@demo.io", url: "/super-admin/groups" },
];

const sessions = {};
const login = async (email, lang) => {
  const key = `${email}:${lang}`;
  if (sessions[key]) return sessions[key];
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Passw0rdGood", captchaToken: "demo" }),
  });
  const body = await res.json();
  if (!body.token) throw new Error(`login ${email}: ${res.status} ${JSON.stringify(body)}`);
  await fetch(`${API}/auth/me/language`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${body.token}` },
    body: JSON.stringify({ language: lang }),
  }).catch(() => {});
  sessions[key] = { token: body.token, user: { ...body.user, language: lang } };
  return sessions[key];
};

const audit = () => {
  const vw = window.innerWidth;
  const out = { dir: document.documentElement.dir, lang: document.documentElement.lang };
  out.pageOverflow = document.documentElement.scrollWidth - vw;
  const scrollable = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(auto|scroll|hidden|clip)/.test(s.overflowX) && p.scrollWidth > p.clientWidth - 1 && p !== document.body && p !== document.documentElement) return true;
    }
    return false;
  };
  const offenders = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const s = getComputedStyle(el);
    if (s.position === "fixed" || s.visibility === "hidden" || el.closest(".sr-only")) continue;
    if ((r.right > vw + 1 || r.left < -1) && !scrollable(el)) {
      offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} [${Math.round(r.left)},${Math.round(r.right)}] "${(el.innerText || "").slice(0, 40)}"`);
    }
  }
  out.offViewport = offenders.slice(0, 8);
  out.offViewportCount = offenders.length;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const keys = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent.trim();
    if (/^[a-z][a-zA-Z]+(\.[a-zA-Z0-9_]+)+$/.test(t)) keys.add(t);
    if (/\{\{\w+\}\}/.test(t)) keys.add(t);
  }
  for (const el of document.querySelectorAll("[aria-label],[placeholder],[title]")) {
    for (const a of ["aria-label", "placeholder", "title"]) {
      const v = el.getAttribute(a);
      if (v && (/^[a-z][a-zA-Z]+(\.[a-zA-Z0-9_]+)+$/.test(v) || /\{\{\w+\}\}/.test(v))) keys.add(`${a}=${v}`);
    }
  }
  out.rawKeys = [...keys];
  // Controls without an accessible name, and touch targets under 44x44 (24 for inline text links).
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden" && !el.closest(".sr-only,[aria-hidden='true']");
  };
  const nameOf = (el) => {
    if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.getAttribute("title")) return true;
    if (["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName)) {
      if (el.type === "hidden") return true;
      if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return true;
      if (el.closest("label")) return true;
      return false;
    }
    return Boolean((el.innerText || el.textContent || "").trim() || el.querySelector("img[alt]"));
  };
  const unlabeled = [];
  const small = [];
  for (const el of document.querySelectorAll("button, a[href], input, select, textarea, [role='button'], [role='tab'], [role='checkbox'], [role='radio']")) {
    if (el.type === "hidden") continue;
    const isFileInput = el.type === "file" && el.classList.contains("sr-only");
    if (!isFileInput && !visible(el)) continue;
    const desc = `${el.tagName.toLowerCase()} "${(el.innerText || el.getAttribute("aria-label") || el.name || "").trim().slice(0, 30)}"`;
    if (!nameOf(el)) unlabeled.push(desc);
    if (isFileInput) continue;
    const r = el.getBoundingClientRect();
    const inlineLink = el.tagName === "A" && getComputedStyle(el).display === "inline";
    const isBox = el.type === "checkbox" || el.type === "radio";
    const min = inlineLink || isBox ? 24 : 44;
    // A checkbox/radio inside a label: the label is the target.
    const target = isBox && el.closest("label") ? el.closest("label").getBoundingClientRect() : r;
    if (Math.min(target.width, target.height) < min - 0.5) small.push(`${desc} ${Math.round(target.width)}x${Math.round(target.height)}`);
  }
  out.unlabeled = unlabeled.slice(0, 10);
  out.smallTargets = small.slice(0, 10);
  out.smallTargetCount = small.length;
  out.alerts = [...document.querySelectorAll('[role="alert"]')].map((a) => a.innerText.trim().slice(0, 120)).filter(Boolean);
  // Latin words in an Urdu UI that are not names, codes or brand words.
  const text = document.body.innerText;
  out.latinWords = [...new Set(text.match(/\b[A-Za-z]{4,}\b/g) || [])].slice(0, 40);
  return out;
};

const langs = langArg.split(",");
fs.mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const report = [];
for (const lang of langs) {
  for (const p of PAGES) {
    const s = await login(p.email.replace("{lang}", lang), lang);
    if (p.startLive) {
      await fetch(`${API}/taking/assessments/${ids.liveId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.token}` },
        body: JSON.stringify({ language: lang }),
      });
    }
    for (const width of WIDTHS) {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 160)}`));
      page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text().slice(0, 160)}`));
      page.on("response", (r) => r.url().startsWith(API) && r.status() >= 400 && errors.push(`http ${r.status()} ${r.url().replace(API, "")}`));
      await page.setViewport({ width, height: 900 });
      await page.evaluateOnNewDocument(
        (token, user, lang) => {
          if (sessionStorage.getItem("__seeded")) return;
          sessionStorage.setItem("__seeded", "1");
          localStorage.setItem("token", token);
          localStorage.setItem("auth-storage", JSON.stringify({ state: { token, user }, version: 0 }));
          localStorage.setItem("gradix.language", lang);
        },
        s.token,
        s.user,
        lang
      );
      await page.goto(APP + p.url, { waitUntil: "networkidle0", timeout: 60000 });
      await new Promise((r) => setTimeout(r, 600));
      if (p.action === "print") {
        const label = JSON.parse(fs.readFileSync(path.join(rootDir, "frontend/src/locales", lang, "detail.json"), "utf8")).printPaper;
        const handle = await page.evaluateHandle((l) => [...document.querySelectorAll("button")].find((b) => b.innerText.trim().includes(l)), label);
        if (handle.asElement()) await handle.asElement().click();
        else errors.push("action: print button not found");
        await new Promise((r) => setTimeout(r, 800));
      }
      if (p.action === "bell") {
        const bell = await page.$('button[aria-haspopup="true"][aria-label]');
        if (bell) await bell.click();
        else errors.push("action: bell not found");
        await new Promise((r) => setTimeout(r, 800));
      }
      const result = await page.evaluate(audit);
      const file = `${p.name}-${lang}-${width}.png`;
      // Grow the viewport to the page instead of fullPage capture (fullPage shifts some RTL pages).
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewport({ width, height: Math.max(900, Math.min(height, 16000)) });
      await new Promise((r) => setTimeout(r, 300));
      await page.screenshot({ path: path.join(outDir, file) });
      const issues = [];
      if (result.pageOverflow > 1) issues.push(`page overflows by ${result.pageOverflow}px`);
      if (result.offViewportCount) issues.push(`${result.offViewportCount} elements outside the viewport`);
      if (lang === "ur" && result.dir !== "rtl") issues.push(`dir=${result.dir}`);
      if (lang === "en" && result.dir === "rtl") issues.push("rtl in English");
      if (result.unlabeled.length) issues.push(`unlabeled controls: ${result.unlabeled.join(" | ")}`);
      if (result.smallTargetCount) issues.push(`${result.smallTargetCount} small touch targets: ${result.smallTargets.join(" | ")}`);
      if (lang === "ar" && result.dir !== "rtl") issues.push(`dir=${result.dir}`);
      if (result.rawKeys.length) issues.push(`raw keys: ${result.rawKeys.join(" | ")}`);
      if (errors.length) issues.push(...errors);
      report.push({ page: p.name, lang, width, file, issues, details: result });
      console.log(`${issues.length ? "ISSUES" : "ok    "} ${file}${issues.length ? `\n   - ${issues.join("\n   - ")}` : ""}`);
      if (result.offViewport.length) console.log(`   offenders: ${result.offViewport.join("\n              ")}`);
      await page.close();
    }
  }
}
await browser.close();
fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log(`DONE ${report.length} screenshots, ${report.filter((r) => r.issues.length).length} with issues`);
