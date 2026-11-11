/**
 * Node load runner equivalent to exam.js / live.js (for machines without k6). Starts
 * demoServer.mjs (V8 heap capped at 384 MB) with N load students, then:
 *   exam: N students start the same assessment at once, autosave every answer twice, advance, finish;
 *   live: one live session with N participants answering over Socket.IO.
 * Reports p50/p95/p99 per endpoint, error rate, timer drift, socket push latency, and the peak
 * memory of the server process tree.
 *
 *   node run-load.mjs <backendDir> <outFile> <users> [exam|live|both]   (PG* env: a throwaway database)
 */
import fs from "fs";
import path from "path";
import { execFileSync, spawn } from "child_process";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const backendDir = path.resolve(process.argv[2]);
const outFile = path.resolve(process.argv[3]);
const USERS = Number(process.argv[4] || 200);
const MODE = process.argv[5] || "both";
const require = createRequire(path.join(backendDir, "package.json"));
const jwt = require("jsonwebtoken");
const { io } = require("socket.io-client");
const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = 5058;
const API = `http://127.0.0.1:${PORT}/api`;
const SECRET = "demo-jwt-secret-not-for-production";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lines = [];
const note = (m) => {
  lines.push(m);
  console.log(m);
};

// ------------------------------------------------------------------ server + memory
const server = spawn(process.execPath, ["--max-old-space-size=384", path.join(here, "..", "scripts", "demoServer.mjs"), backendDir, String(PORT)], {
  env: { ...process.env, DEMO_LOAD_STUDENTS: String(USERS) },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
server.stdout.on("data", (d) => (output += d));
server.stderr.on("data", (d) => (output += d));
server.on("exit", (code, signal) => (output += `
[server exited: code ${code}, signal ${signal}]
`));
const treeMb = () => {
  const script = `$all = Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,WorkingSetSize; $ids=@(${server.pid}); $added=$true
while ($added) { $added=$false; foreach ($p in $all) { if ($ids -contains $p.ParentProcessId -and -not ($ids -contains $p.ProcessId)) { $ids += $p.ProcessId; $added=$true } } }
[math]::Round((($all | Where-Object { $ids -contains $_.ProcessId } | Measure-Object WorkingSetSize -Sum).Sum)/1MB)`;
  return Number(execFileSync("powershell", ["-NoProfile", "-Command", script], { encoding: "utf8" }).trim());
};
let peakMb = 0;
let sampling = true;
const sampler = (async () => {
  while (sampling) {
    try {
      peakMb = Math.max(peakMb, treeMb());
    } catch {
      // ignore
    }
    await sleep(500);
  }
})();

// ------------------------------------------------------------------ metrics
const timings = {};
const errors = {};
const record = (name, ms, ok, status) => {
  (timings[name] ||= []).push(ms);
  if (!ok) errors[`${name} ${status}`] = (errors[`${name} ${status}`] || 0) + 1;
};
const pct = (list, p) => {
  if (!list.length) return 0;
  const s = [...list].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]);
};
const call = async (name, method, p, headers, body) => {
  const t0 = performance.now();
  try {
    const res = await fetch(`${API}${p}`, { method, headers: { "content-type": "application/json", ...headers }, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => ({}));
    record(name, performance.now() - t0, res.ok, res.status);
    return { status: res.status, body: json };
  } catch (error) {
    record(name, performance.now() - t0, false, error.cause?.code || "network");
    return { status: 0, body: {} };
  }
};
const summary = (title) => {
  note(`\n### ${title}\n\n| Endpoint | Requests | p50 ms | p95 ms | p99 ms | max ms |\n|---|---|---|---|---|---|`);
  for (const [name, list] of Object.entries(timings)) note(`| ${name} | ${list.length} | ${pct(list, 50)} | ${pct(list, 95)} | ${pct(list, 99)} | ${Math.round(Math.max(...list))} |`);
  const total = Object.values(timings).reduce((s, l) => s + l.length, 0);
  const failed = Object.values(errors).reduce((s, n) => s + n, 0);
  note(`\nRequests: ${total}, failed: ${failed} (${((100 * failed) / Math.max(1, total)).toFixed(2)}%)${failed ? ` ${JSON.stringify(errors)}` : ""}`);
  for (const k of Object.keys(timings)) delete timings[k];
  for (const k of Object.keys(errors)) delete errors[k];
};

// ------------------------------------------------------------------ scenarios
const examUser = async (assessment, student, drift, done) => {
  const H = { Authorization: `Bearer ${jwt.sign({ id: student.id, email: student.email, role: "student" }, SECRET)}` };
  await call("GET state", "GET", `/taking/assessments/${assessment}/attempt`, H);
  const started = await call("POST start", "POST", `/taking/assessments/${assessment}/start`, H, { language: "en" });
  let current = started.body.data;
  if (!current?.question) return;
  for (let i = 0; i < current.totalQuestions; i++) {
    await sleep(1000 + Math.random() * 2000);
    const opts = current.question.options || [];
    await call("PUT answer (autosave)", "PUT", `/taking/attempts/${current.attemptId}/answers/${current.question.id}`, H, { answer: opts[1] ?? true });
    await sleep(300 + Math.random() * 1000);
    await call("PUT answer (autosave)", "PUT", `/taking/attempts/${current.attemptId}/answers/${current.question.id}`, H, { answer: opts[0] ?? true });
    if (i % 3 === 1) {
      const a = await call("GET state", "GET", `/taking/assessments/${assessment}/attempt`, H);
      const t0 = Date.now();
      await sleep(2000);
      const b = await call("GET state", "GET", `/taking/assessments/${assessment}/attempt`, H);
      const x = a.body.data?.questionRemainingSeconds;
      const y = b.body.data?.questionRemainingSeconds;
      // remaining seconds are rounded up by the server, so allow its 1-second resolution.
      if (typeof x === "number" && typeof y === "number") drift.push(Math.max(0, Math.abs(x - y - (Date.now() - t0) / 1000) - 1) * 1000);
    }
    const next = await call("POST advance", "POST", `/taking/attempts/${current.attemptId}/advance`, H, { fromIndex: i });
    if (next.body.data?.finished) {
      done.push(true);
      return;
    }
    if (!next.body.data) return;
    current = next.body.data;
  }
};

const liveTest = async (ids) => {
  const T = { Authorization: `Bearer ${jwt.sign({ id: ids.instructor, email: "instructor@demo.io", role: "instructor" }, SECRET)}` };
  const created = await call("POST live session", "POST", "/live/sessions", T, { source: "bank", assessmentId: ids.loadAssessment, count: 5, secondsPerQuestion: 20 });
  const { id, code } = created.body.data.session;
  const latency = [];
  let answered = 0;
  const sockets = [];
  await Promise.all(
    Array.from({ length: USERS }, async (_, n) => {
      await sleep(Math.random() * 5000);
      const joined = await call("POST join", "POST", "/live/join", {}, { code, nickname: `P${n + 1}` });
      const token = joined.body.data?.token;
      if (!token) return;
      const L = { "X-Live-Token": token };
      const socket = io(`http://127.0.0.1:${PORT}`, { auth: { liveToken: token }, transports: ["websocket"] });
      sockets.push(socket);
      let last = -1;
      socket.on("live:state", async (s) => {
        if (s.serverNow && s.kind !== "connected") latency.push(Date.now() - Date.parse(s.serverNow));
        if (s.phase !== "question" || s.currentIndex === last) return;
        last = s.currentIndex;
        const me = await call("GET live/me", "GET", "/live/me", L);
        const q = me.body.data?.question;
        if (!q) return;
        await sleep(Math.random() * 4000);
        const res = await call("POST live answer", "POST", "/live/me/answer", L, { index: q.index, answer: (q.options || [true])[0] });
        if (res.status === 200) answered += 1;
      });
    })
  );
  await sleep(3000);
  const control = (action) => call("POST control", "POST", `/live/sessions/${id}/control`, T, { action });
  await control("start");
  for (let q = 0; q < 5; q++) {
    await sleep(9000);
    await control("reveal");
    await sleep(2000);
    await control("next");
  }
  await sleep(2000);
  for (const s of sockets) s.close();
  note(`\nLive: ${sockets.length} participants connected, ${answered} answers accepted (expected ${sockets.length * 5}); socket push latency p50 ${pct(latency, 50)} ms, p95 ${pct(latency, 95)} ms, p99 ${pct(latency, 99)} ms (${latency.length} pushes)`);
};

// ------------------------------------------------------------------ run
try {
  let ids = null;
  for (let i = 0; i < 240 && !ids; i++) {
    const m = output.match(/DEMO READY \d+ (.*)/);
    if (m) ids = JSON.parse(m[1]);
    else await sleep(1000);
  }
  if (!ids) throw new Error(`server did not start: ${output.slice(-600)}`);
  note(`## Load test: ${USERS} users (${new Date().toISOString()})\n\n${(output.match(/load test: .*/) || [""])[0]}`);
  if (MODE !== "live") {
    const drift = [];
    const done = [];
    const t0 = Date.now();
    await Promise.all(ids.loadStudents.map((s) => examUser(ids.loadAssessment, s, drift, done)));
    summary(`Exam: ${USERS} students, same assessment, autosave (${Math.round((Date.now() - t0) / 1000)} s)`);
    note(`Finished exams: ${done.length}/${USERS}. Timer drift beyond the 1 s display resolution: p95 ${pct(drift, 95)} ms, p99 ${pct(drift, 99)} ms, max ${Math.round(Math.max(0, ...drift))} ms (${drift.length} checks)`);
  }
  if (MODE !== "exam") {
    await liveTest(ids);
    summary(`Live session: ${USERS} participants`);
  }
} catch (error) {
  note(`FAILED: ${error.message}`);
} finally {
  sampling = false;
  await sampler;
  server.kill();
  note(`\nPeak memory of the server (Node + children): ${peakMb} MB`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.appendFileSync(outFile, `${lines.join("\n")}\n\n`);
  fs.writeFileSync(outFile.replace(/\.md$/, `-server-${USERS}.log`), output.replace(/AIza[\w-]+|gsk_\w+/g, "[redacted]").slice(-20000));
  process.exit(0);
}
