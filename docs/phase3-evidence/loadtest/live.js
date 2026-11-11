/**
 * Load test (b): one live session with VUS participants (default 200) answering in real time
 * over Socket.IO (spoken directly: Engine.IO v4 frames over a WebSocket).
 * A teacher scenario starts the session, then reveals and moves on every few seconds.
 *
 *   k6 run -e API=http://host.docker.internal:5056 -e INSTRUCTOR_ID=<id> -e ASSESSMENT=<id> live.js
 *
 * Socket latency = time from the server sending "live:state" (its serverNow) to the participant
 * receiving it. Answer latency = the REST answer round trip.
 */
import http from "k6/http";
import ws from "k6/ws";
import { check, sleep } from "k6";
import { Trend, Counter } from "k6/metrics";
import { tokenFor } from "./jwt.js";

const BASE = __ENV.API || "http://host.docker.internal:5056";
const API = `${BASE}/api`;
const WS = `${BASE.replace(/^http/, "ws")}/socket.io/?EIO=4&transport=websocket`;
const VUS = Number(__ENV.VUS || 200);
const QUESTIONS = 5;

export const options = {
  scenarios: {
    participants: { executor: "per-vu-iterations", exec: "participant", vus: VUS, iterations: 1, maxDuration: "6m", startTime: "2s" },
    teacher: { executor: "per-vu-iterations", exec: "teacher", vus: 1, iterations: 1, maxDuration: "6m", startTime: "0s" },
  },
  thresholds: {
    socket_latency_ms: ["p(95)<1000"],
    http_req_failed: ["rate<0.01"],
  },
  summaryTrendStats: ["avg", "p(50)", "p(95)", "p(99)", "max"],
};

const socketLatency = new Trend("socket_latency_ms");
const answered = new Counter("answers_accepted");
const pushes = new Counter("state_pushes_received");

const teacherHeaders = () => ({
  Authorization: `Bearer ${tokenFor({ id: Number(__ENV.INSTRUCTOR_ID), email: "instructor@demo.io", role: "instructor" })}`,
  "Content-Type": "application/json",
});

export function setup() {
  const res = http.post(
    `${API}/live/sessions`,
    JSON.stringify({ source: "bank", assessmentId: Number(__ENV.ASSESSMENT), language: "en", count: QUESTIONS, secondsPerQuestion: 20 }),
    { headers: teacherHeaders() }
  );
  check(res, { "session created": (r) => r.status === 201 });
  return { id: res.json("data.session.id"), code: res.json("data.session.code") };
}

export function teacher(data) {
  const control = (action) => http.post(`${API}/live/sessions/${data.id}/control`, JSON.stringify({ action }), { headers: teacherHeaders(), tags: { name: "control" } });
  sleep(25); // let everyone join
  control("start");
  for (let q = 0; q < QUESTIONS; q++) {
    sleep(10);
    control("reveal");
    sleep(3);
    control("next");
  }
}

export function participant(data) {
  const join = http.post(`${API}/live/join`, JSON.stringify({ code: data.code, nickname: `P${__VU}` }), { headers: { "Content-Type": "application/json" }, tags: { name: "join" } });
  if (!check(join, { joined: (r) => r.status === 201 })) return;
  const token = join.json("data.token");
  const liveHeaders = { "X-Live-Token": token, "Content-Type": "application/json" };
  let lastIndex = -1;

  const answer = () => {
    const me = http.get(`${API}/live/me`, { headers: liveHeaders, tags: { name: "me" } });
    const q = me.json("data.question");
    if (!q || q.index === lastIndex || me.json("data.myAnswer")) return;
    lastIndex = q.index;
    sleep(Math.random() * 4);
    const res = http.post(`${API}/live/me/answer`, JSON.stringify({ index: q.index, answer: (q.options || [true])[0] }), { headers: liveHeaders, tags: { name: "answer" } });
    if (res.status === 200) answered.add(1);
  };

  ws.connect(WS, {}, (socket) => {
    socket.on("message", (msg) => {
      if (msg.startsWith("0")) socket.send(`40${JSON.stringify({ liveToken: token })}`);
      else if (msg === "2") socket.send("3");
      else if (msg.startsWith("42")) {
        const [event, payload] = JSON.parse(msg.slice(2));
        if (event !== "live:state") return;
        pushes.add(1);
        if (payload.serverNow) socketLatency.add(Date.now() - Date.parse(payload.serverNow));
        if (payload.status === "ended") socket.close();
        else if (payload.phase === "question") answer();
      }
    });
    socket.setTimeout(() => socket.close(), 5 * 60 * 1000);
  });
}
