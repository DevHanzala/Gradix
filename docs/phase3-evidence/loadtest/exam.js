/**
 * Load test (a): VUS students (default 200) start the same assessment at once, answer every
 * question with autosave (each answer saved twice, as when a student changes their mind), move
 * on, and finish. The LLM is mocked and the pool pre-generated (demoServer.mjs, DEMO_LOAD_STUDENTS).
 *
 *   k6 run -e API=http://host.docker.internal:5056 -e ASSESSMENT=<id> -e FIRST_ID=<first load student id> exam.js
 *
 * Timer drift (NFR-2): on some questions the student waits ~2 s and asks for the state again;
 * drift = |(remaining before - remaining after) - real elapsed time|.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";
import { tokenFor } from "./jwt.js";

const API = `${__ENV.API || "http://host.docker.internal:5056"}/api`;
const ASSESSMENT = __ENV.ASSESSMENT;
const FIRST_ID = Number(__ENV.FIRST_ID);
const VUS = Number(__ENV.VUS || 200);

export const options = {
  scenarios: {
    exam: { executor: "per-vu-iterations", vus: VUS, iterations: 1, maxDuration: "20m" },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{name:save}": ["p(95)<1000"],
    timer_drift_ms: ["p(99)<1000"],
  },
  summaryTrendStats: ["avg", "p(50)", "p(95)", "p(99)", "max"],
};

const drift = new Trend("timer_drift_ms");
const finished = new Rate("exam_finished");
const errors = new Counter("app_errors");

export default function () {
  const n = __VU;
  const user = { id: FIRST_ID + n - 1, email: `load-${n}@demo.io`, role: "student" };
  const headers = { Authorization: `Bearer ${tokenFor(user)}`, "Content-Type": "application/json" };
  const call = (method, path, body, name) => http.request(method, `${API}${path}`, body ? JSON.stringify(body) : null, { headers, tags: { name } });

  call("GET", `/taking/assessments/${ASSESSMENT}/attempt`, null, "state");
  let res = call("POST", `/taking/assessments/${ASSESSMENT}/start`, { language: "en" }, "start");
  if (!check(res, { "started": (r) => r.status === 200 })) {
    errors.add(1, { step: "start", status: String(res.status) });
    finished.add(false);
    return;
  }
  let current = res.json("data");
  for (let i = 0; i < current.totalQuestions; i++) {
    sleep(1 + Math.random() * 2); // reading the question
    const options = current.question.options || [];
    call("PUT", `/taking/attempts/${current.attemptId}/answers/${current.question.id}`, { answer: options[1] ?? true }, "save");
    sleep(0.3 + Math.random());
    res = call("PUT", `/taking/attempts/${current.attemptId}/answers/${current.question.id}`, { answer: options[0] ?? true }, "save");
    check(res, { "saved": (r) => r.status === 200 });

    if (i % 3 === 1) {
      const before = call("GET", `/taking/assessments/${ASSESSMENT}/attempt`, null, "state");
      const t0 = Date.now();
      sleep(2);
      const after = call("GET", `/taking/assessments/${ASSESSMENT}/attempt`, null, "state");
      const elapsed = (Date.now() - t0) / 1000;
      const a = before.json("data.questionRemainingSeconds");
      const b = after.json("data.questionRemainingSeconds");
      if (typeof a === "number" && typeof b === "number") drift.add(Math.abs(a - b - elapsed) * 1000);
    }

    res = call("POST", `/taking/attempts/${current.attemptId}/advance`, { fromIndex: i }, "advance");
    if (!check(res, { "advanced": (r) => r.status === 200 })) {
      errors.add(1, { step: "advance", status: String(res.status) });
      break;
    }
    const next = res.json("data");
    if (next.finished) {
      finished.add(true);
      return;
    }
    current = next;
  }
  finished.add(false);
}
