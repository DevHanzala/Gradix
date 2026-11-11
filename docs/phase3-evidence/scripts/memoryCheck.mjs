/**
 * Peak memory of the backend in a 512 MB container (like Render's free instance) while it
 * generates a question pool, renders a PDF report (Chromium) and prints DOCX and PDF papers.
 *
 *   node memoryCheck.mjs <outDir>
 * Needs: image gradix-memtest (see Dockerfile.memtest), PG* env pointing at a throwaway database
 * reachable from Docker (host.docker.internal). Memory comes from `docker stats` (the whole
 * container: Node AND Chromium), sampled every 500 ms.
 */
import fs from "fs";
import path from "path";
import { execFileSync, spawn } from "child_process";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const outDir = path.resolve(process.argv[2] || ".");
fs.mkdirSync(outDir, { recursive: true });
const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "backend", "package.json"));
const jwt = require("jsonwebtoken");
const API = "http://127.0.0.1:5056";
const NAME = "gradix-memtest-run";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = [];
const note = (m) => {
  log.push(m);
  console.log(m);
};

try {
  execFileSync("docker", ["rm", "-f", NAME], { stdio: "ignore" });
} catch {
  // not running
}
const env = ["PGHOST=host.docker.internal", `PGPORT=${process.env.PGPORT}`, `PGUSER=${process.env.PGUSER}`, `PGDATABASE=${process.env.PGDATABASE}`, "PGSSLMODE=disable", "DEMO_HOST=0.0.0.0", "NODE_ENV=production"];
const args = ["run", "--name", NAME, "--memory=512m", "--memory-swap=512m", "-p", "5056:5056"];
for (const e of env) args.push("-e", e);
args.push("-e", "PGPASSWORD", "gradix-memtest");
const container = spawn("docker", args, { env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"] });
let output = "";
container.stdout.on("data", (d) => (output += d));
container.stderr.on("data", (d) => (output += d));

const ready = async () => {
  for (let i = 0; i < 120; i++) {
    const m = output.match(/DEMO READY \d+ (.*)/);
    if (m) return JSON.parse(m[1]);
    await sleep(1000);
  }
  throw new Error(`container did not start: ${output.slice(-800)}`);
};

// Memory sampling
let phase = "boot";
const peaks = {};
let sampling = true;
const sample = async () => {
  while (sampling) {
    try {
      const out = execFileSync("docker", ["stats", NAME, "--no-stream", "--format", "{{.MemUsage}}"], { encoding: "utf8" }).trim();
      const m = out.match(/([\d.]+)\s*(MiB|GiB|KiB)/);
      if (m) {
        const mib = Number(m[1]) * (m[2] === "GiB" ? 1024 : m[2] === "KiB" ? 1 / 1024 : 1);
        peaks[phase] = Math.max(peaks[phase] || 0, mib);
      }
    } catch {
      // container gone
    }
    await sleep(500);
  }
};

const results = [];
try {
  const ids = await ready();
  note(`container up (512 MB limit): ${JSON.stringify(ids)}`);
  const sampler = sample();
  await sleep(3000);
  const SECRET = "demo-jwt-secret-not-for-production";
  const T = { Authorization: `Bearer ${jwt.sign({ id: ids.instructor, email: "instructor@demo.io", role: "instructor" }, SECRET)}` };
  const S = { Authorization: `Bearer ${jwt.sign({ id: ids.students[0], email: "ali@demo.io", role: "student" }, SECRET)}` };
  const call = async (method, p, headers, body, binary = false) => {
    const res = await fetch(`${API}/api${p}`, { method, headers: { "content-type": "application/json", ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: binary ? Buffer.from(await res.arrayBuffer()) : await res.json() };
  };

  phase = "idle";
  await sleep(4000);

  // 1. Question pool for a new assessment (create + publish in two languages).
  phase = "pool generation";
  const form = new FormData();
  form.append("title", "Memory test");
  form.append("prompt", "How plants make food");
  form.append("question_blocks", JSON.stringify([{ question_type: "multiple_choice", question_count: 10, duration_per_question: 60, num_options: 4, positive_marks: 1, negative_marks: 0 }]));
  form.append("files", new Blob([Array.from({ length: 200 }, (_, i) => `Fact ${i}: plants make sugar from light and water in their leaves.`).join(" ")], { type: "text/plain" }), "lesson.txt");
  const created = await (await fetch(`${API}/api/assessments`, { method: "POST", headers: T, body: form })).json();
  const pub = await call("POST", `/assessments/${created.data.id}/publish`, T, { languages: ["en", "ur", "ar"] });
  results.push(["pool generation (3 languages)", pub.status]);
  await sleep(2000);

  // 2. A student takes the seeded assessment and downloads the PDF report (real Chromium).
  phase = "PDF report";
  let current = (await call("POST", `/taking/assessments/${ids.assessment}/start`, S, { language: "ur" })).body.data;
  for (let i = 0; current && i < current.totalQuestions; i++) {
    await call("PUT", `/taking/attempts/${current.attemptId}/answers/${current.question.id}`, S, { answer: current.question.options?.[0] ?? true });
    const next = (await call("POST", `/taking/attempts/${current.attemptId}/advance`, S, { fromIndex: i })).body.data;
    if (next.finished) break;
    current = next;
  }
  const report = await call("GET", `/student-analytics/results/${ids.assessment}/report.pdf?language=ur`, S, null, true);
  results.push(["PDF report (Urdu)", report.status, `${Math.round(report.body.length / 1024)} KB`]);

  // 3. Papers: DOCX and PDF, 3 unique copies each.
  phase = "DOCX paper";
  const docx = await call("POST", `/assessments/${ids.assessment}/print`, T, { language: "ur", format: "docx", mode: "unique", copies: 3, instituteName: "Test School" }, true);
  results.push(["DOCX paper x3", docx.status, `${Math.round(docx.body.length / 1024)} KB`]);
  phase = "PDF paper";
  const pdf = await call("POST", `/assessments/${ids.assessment}/print`, T, { language: "ar", mode: "unique", copies: 3, instituteName: "Test School" }, true);
  results.push(["PDF paper x3", pdf.status, `${Math.round(pdf.body.length / 1024)} KB`]);

  phase = "after";
  await sleep(4000);
  const health = await call("GET", "/health", {});
  results.push(["/api/health", health.status, health.body.status]);
  sampling = false;
  await sampler;
} catch (error) {
  note(`FAILED: ${error.message}`);
  sampling = false;
} finally {
  let oom = "unknown";
  try {
    oom = execFileSync("docker", ["inspect", NAME, "--format", "{{.State.OOMKilled}}"], { encoding: "utf8" }).trim();
  } catch {
    // ignore
  }
  try {
    execFileSync("docker", ["rm", "-f", NAME], { stdio: "ignore" });
  } catch {
    // ignore
  }
  note("\n| Step | Status | Detail |\n|---|---|---|");
  for (const r of results) note(`| ${r[0]} | ${r[1]} | ${r[2] ?? ""} |`);
  note("\n| Phase | Peak memory (container, MiB) |\n|---|---|");
  for (const [p, v] of Object.entries(peaks)) note(`| ${p} | ${v.toFixed(0)} |`);
  note(`\nOOM-killed: ${oom}`);
  fs.writeFileSync(path.join(outDir, "memory.md"), `${log.join("\n")}\n`);
  fs.writeFileSync(path.join(outDir, "memory-container.log"), output.replace(/AIza[\w-]+|gsk_[\w]+/g, "[redacted]"));
}
