import jwt from "jsonwebtoken";
import { findUserByEmail } from "../../models/userModel.js";
import { liveEvents } from "./liveEvents.js";
import { verifyParticipantToken, hostView, livePublicState, openTimers, endExpiredSessions } from "./live.service.js";
import db from "../../DB/db.js";

/**
 * Socket.IO for live sessions. Sockets only PUSH: every command (join, answer,
 * start, next...) is a REST call, and every client rebuilds its screen from the
 * REST state, so a dropped connection or a server restart loses nothing.
 *
 * Rooms: live:<id> (everyone in a session), host:<id> (its teacher), p:<id> (one participant).
 * Events: "live:state" (public session state), "live:board" (teacher view, throttled),
 *         "live:removed" (to a removed participant).
 * Auth: a login JWT (teacher) or a live participant token, in handshake.auth.
 */
const BOARD_THROTTLE_MS = 400;

let io = null;
const timers = new Map();
const boardTimers = new Map();

export const realtimeStats = () => ({ connected: io ? io.engine.clientsCount : 0, timers: timers.size });

const loadState = async (sessionId) => (await db.query(`SELECT * FROM live_sessions WHERE id = $1`, [sessionId])).rows[0];

/** Push the teacher board at most every BOARD_THROTTLE_MS per session (200 answers -> a few pushes). */
const scheduleBoard = (sessionId) => {
  if (boardTimers.has(sessionId)) return;
  boardTimers.set(
    sessionId,
    setTimeout(async () => {
      boardTimers.delete(sessionId);
      try {
        io.to(`host:${sessionId}`).emit("live:board", await hostView(sessionId));
      } catch (error) {
        console.error(`[live] board ${sessionId}: ${error.message}`);
      }
    }, BOARD_THROTTLE_MS)
  );
};

/** Emit when a question's time runs out or a student-paced session reaches its end. */
const armTimer = (session) => {
  clearTimeout(timers.get(session.id));
  timers.delete(session.id);
  const at = session.pacing === "teacher" ? session.question_deadline : session.ends_at;
  if (!at || !["running"].includes(session.status)) return;
  const delay = Math.max(0, new Date(at).getTime() - Date.now()) + 50;
  const timer = setTimeout(async () => {
    timers.delete(session.id);
    if (session.pacing === "student") await endExpiredSessions().catch(() => {});
    await broadcast(session.id, "timer").catch(() => {});
  }, delay);
  timer.unref?.();
  timers.set(session.id, timer);
};

const broadcast = async (sessionId, kind) => {
  if (!io) return;
  const session = await loadState(sessionId);
  if (!session) return;
  io.to(`live:${sessionId}`).emit("live:state", { ...livePublicState(session), kind });
  scheduleBoard(sessionId);
  if (["start", "next", "resume", "pause", "end", "reveal", "timer"].includes(kind)) armTimer(session);
};

const authenticate = async (socket) => {
  const { token, liveToken } = socket.handshake.auth || {};
  if (liveToken) {
    const { sessionId, participantId } = verifyParticipantToken(liveToken);
    const { rows } = await db.query(`SELECT removed_at FROM live_participants WHERE id = $1 AND session_id = $2`, [participantId, sessionId]);
    if (!rows[0] || rows[0].removed_at) throw new Error("not a participant");
    return { kind: "participant", sessionId, participantId };
  }
  if (token) {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await findUserByEmail(decoded.email);
    if (!user) throw new Error("unknown user");
    return { kind: "user", user: { id: user.id, role: user.role } };
  }
  throw new Error("no credentials");
};

export const attachRealtime = async (httpServer) => {
  const { Server } = await import("socket.io");
  io = new Server(httpServer, {
    cors: { origin: process.env.FRONTEND_URL, credentials: true },
    // WebSocket first; long-polling is the fallback when a proxy or network blocks WebSockets.
    transports: ["websocket", "polling"],
    pingInterval: 20000,
    pingTimeout: 20000,
  });

  io.use(async (socket, next) => {
    try {
      socket.data.auth = await authenticate(socket);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const auth = socket.data.auth;
    if (auth.kind === "participant") {
      socket.join([`live:${auth.sessionId}`, `p:${auth.participantId}`]);
      loadState(auth.sessionId).then((s) => s && socket.emit("live:state", { ...livePublicState(s), kind: "connected" }));
      scheduleBoard(auth.sessionId);
    }
    // Teachers watch a session they own.
    socket.on("live:watch", async (sessionId, ack) => {
      try {
        if (auth.kind !== "user") throw new Error("forbidden");
        const s = await loadState(Number(sessionId));
        if (!s || (s.instructor_id !== auth.user.id && auth.user.role !== "super_admin")) throw new Error("forbidden");
        socket.join([`live:${s.id}`, `host:${s.id}`]);
        socket.emit("live:board", await hostView(s.id));
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false });
      }
    });
    socket.on("disconnect", () => {
      if (auth.kind === "participant") scheduleBoard(auth.sessionId);
    });
  });

  liveEvents.changed = (sessionId, kind) => {
    broadcast(sessionId, kind).catch((error) => console.error(`[live] broadcast ${sessionId}: ${error.message}`));
  };
  liveEvents.removed = (sessionId, participantId) => {
    io.to(`p:${participantId}`).emit("live:removed", { sessionId });
    io.in(`p:${participantId}`).disconnectSockets(true);
  };

  // After a restart: re-arm timers of sessions that are still running, end expired ones.
  await endExpiredSessions().catch(() => {});
  for (const s of await openTimers().catch(() => [])) armTimer({ ...s, status: "running" });
  return io;
};

export const closeRealtime = async () => {
  for (const t of [...timers.values(), ...boardTimers.values()]) clearTimeout(t);
  timers.clear();
  boardTimers.clear();
  if (io) await new Promise((resolve) => io.close(() => resolve()));
  io = null;
};
