import db from "../DB/db.js";
import { storage } from "../helper/storage.js";
import { queueAdapter } from "../jobs/queue.js";

/**
 * /api/health: database, file storage and job queue, each with a 2-second timeout,
 * cached for 5 seconds so a busy uptime monitor never adds load. HTTP 503 only when
 * the database is down (nothing works then); storage or queue problems report
 * "degraded" with 200 so the service is not restarted for them.
 */
const TIMEOUT_MS = 2000;
const CACHE_MS = 5000;
let cached = null;

const timed = async (fn) => {
  const started = Date.now();
  try {
    const detail = await Promise.race([fn(), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS).unref?.())]);
    return { status: "ok", ms: Date.now() - started, ...(detail && typeof detail === "object" ? detail : {}) };
  } catch (error) {
    return { status: "error", ms: Date.now() - started, error: String(error.message).slice(0, 120) };
  }
};

const checkJobs = async () => {
  if (queueAdapter.mode !== "pgboss") return { mode: queueAdapter.mode };
  const { rows } = await db.query(
    `SELECT count(*)::int AS waiting FROM pgboss.job WHERE state IN ('created', 'retry') AND created_on < NOW() - interval '10 minutes'`
  );
  return { mode: "pgboss", stuck: rows[0].waiting };
};

export const healthReport = async () => {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.report;
  const [database, files, jobs] = await Promise.all([timed(() => db.query("SELECT 1")), timed(() => storage.check()), timed(checkJobs)]);
  const status = database.status !== "ok" ? "down" : files.status !== "ok" || jobs.status !== "ok" ? "degraded" : "ok";
  const report = {
    success: status !== "down",
    status,
    message: "Gradix backend is running",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().rss / 1048576),
    checks: { database, storage: { driver: storage.driverName, ...files }, jobs },
  };
  cached = { at: Date.now(), report };
  return report;
};
