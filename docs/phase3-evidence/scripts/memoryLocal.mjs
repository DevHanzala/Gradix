/**
 * Peak memory of the backend on this (Windows) machine, with the V8 heap capped at 384 MB
 * (node --max-old-space-size=384), while it generates question pools, renders a PDF report
 * (real Chromium) and prints DOCX and PDF papers. Memory = working set of the Node process
 * PLUS all its child processes (Chromium), sampled every ~700 ms with PowerShell.
 *
 *   node memoryLocal.mjs <backendDir> <outDir>      (PG* env: a throwaway database)
 * The 512 MB container version is memoryCheck.mjs (needs Docker with ~3 GB free disk).
 */
import fs from "fs";
import path from "path";
import { execFileSync, spawn } from "child_process";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const backendDir = path.resolve(process.argv[2]);
const outDir = path.resolve(process.argv[3] || ".");
fs.mkdirSync(outDir, { recursive: true });
const require = createRequire(path.join(backendDir, "package.json"));
const jwt = require("jsonwebtoken");
const here = path.dirname(fileURLToPath(import.meta.url));
const API = "http://127.0.0.1:5057";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = [];
const note = (m) => {
  log.push(m);
  console.log(m);
};

const server = spawn(process.execPath, ["--max-old-space-size=384", path.join(here, "demoServer.mjs"), backendDir, "5057"], {
  env: { ...process.env, NODE_ENV_OVERRIDE: "production" },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
server.stdout.on("data", (d) => (output += d));
server.stderr.on("data", (d) => (output += d));

const treeMb = (pid) => {
  const script = `$all = Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,WorkingSetSize;
$ids = @(${pid}); $added = $true
while ($added) { $added = $false; foreach ($p in $all) { if ($ids -contains $p.ParentProcessId -and -not ($ids -contains $p.ProcessId)) { $ids += $p.ProcessId; $added = $true } } }
$sum = ($all | Where-Object { $ids -contains $_.ProcessId } | Measure-Object WorkingSetSize -Sum).Sum
[math]::Round($sum / 1MB)`;
  return Number(execFileSync("powershell", ["-NoProfile", "-Command", script], { encoding: "utf8" }).trim());
};

let phase = "boot";
const peaks = {};
let sampling = true;
const sampler = (async () => {
  while (sampling) {
    try {
      const mb = treeMb(server.pid);
      if (mb) peaks[phase] = Math.max(peaks[phase] || 0, mb);
    } catch {
      // process gone
    }
    await sleep(200);
  }
})();

const results = [];
try {
  let ids = null;
  for (let i = 0; i < 120 && !ids; i++) {
    const m = output.match(/DEMO READY \d+ (.*)/);
    if (m) ids = JSON.parse(m[1]);
    else await sleep(1000);
  }
  if (!ids) throw new Error(`server did not start: ${output.slice(-600)}`);
  note(`server up: ${JSON.stringify(ids)}`);
  const SECRET = "demo-jwt-secret-not-for-production";
  const T = { Authorization: `Bearer ${jwt.sign({ id: ids.instructor, email: "instructor@demo.io", role: "instructor" }, SECRET)}` };
  const S = { Authorization: `Bearer ${jwt.sign({ id: ids.students[0], email: "ali@demo.io", role: "student" }, SECRET)}` };
  const call = async (method, p, headers, body, binary = false) => {
    const res = await fetch(`${API}/api${p}`, { method, headers: { "content-type": "application/json", ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: binary ? Buffer.from(await res.arrayBuffer()) : await res.json() };
  };

  phase = "idle";
  await sleep(4000);

  phase = "pool generation";
  const form = new FormData();
  form.append("title", "Memory test");
  form.append("prompt", "How plants make food");
  form.append("question_blocks", JSON.stringify([{ question_type: "multiple_choice", question_count: 10, duration_per_question: 60, num_options: 4, positive_marks: 1, negative_marks: 0 }]));
  form.append("files", new Blob([Array.from({ length: 200 }, (_, i) => `Fact ${i}: plants make sugar from light and water in their leaves.`).join(" ")], { type: "text/plain" }), "lesson.txt");
  const created = await (await fetch(`${API}/api/assessments`, { method: "POST", headers: T, body: form })).json();
  const pub = await call("POST", `/assessments/${created.data.id}/publish`, T, { languages: ["en", "ur", "ar"] });
  results.push(["pool generation (3 languages)", pub.status, `${pub.body.data?.languages?.map((l) => `${l.language} ${l.questions}`).join(", ") || ""}`]);

  phase = "PDF report";
  let current = (await call("POST", `/taking/assessments/${ids.assessment}/start`, S, { language: "ur" })).body.data;
  for (let i = 0; current && i < current.totalQuestions; i++) {
    await call("PUT", `/taking/attempts/${current.attemptId}/answers/${current.question.id}`, S, { answer: current.question.options?.[0] ?? true });
    const next = (await call("POST", `/taking/attempts/${current.attemptId}/advance`, S, { fromIndex: i })).body.data;
    if (next.finished) break;
    current = next;
  }
  const report = await call("GET", `/student-analytics/results/${ids.assessment}/report.pdf?language=ur`, S, null, true);
  results.push(["PDF report (Urdu, real Chromium)", report.status, `${Math.round(report.body.length / 1024)} KB`]);

  phase = "DOCX paper";
  const docx = await call("POST", `/assessments/${ids.assessment}/print`, T, { language: "ur", format: "docx", mode: "unique", copies: 3, instituteName: "Test School" }, true);
  results.push(["DOCX paper x3 (Urdu)", docx.status, `${Math.round(docx.body.length / 1024)} KB`]);
  phase = "PDF paper";
  const pdf = await call("POST", `/assessments/${ids.assessment}/print`, T, { language: "ar", mode: "unique", copies: 3, instituteName: "Test School" }, true);
  results.push(["PDF paper x3 (Arabic)", pdf.status, `${Math.round(pdf.body.length / 1024)} KB`]);

  phase = "after";
  await sleep(4000);
  const health = await call("GET", "/health", {});
  results.push(["/api/health", health.status, `${health.body.status}, Node RSS ${health.body.memoryMb} MB`]);
} catch (error) {
  note(`FAILED: ${error.message}`);
} finally {
  sampling = false;
  await sampler;
  server.kill();
  note("\n| Step | Status | Detail |\n|---|---|---|");
  for (const r of results) note(`| ${r[0]} | ${r[1]} | ${r[2] ?? ""} |`);
  note("\n| Phase | Peak memory, Node + Chromium (MB) |\n|---|---|");
  for (const [p, v] of Object.entries(peaks)) note(`| ${p} | ${v} |`);
  fs.writeFileSync(path.join(outDir, "memory-local.md"), `${log.join("\n")}\n`);
}
