import { randomUUID } from "crypto";

/**
 * Request IDs and structured logs. Every request gets an ID (or keeps the
 * X-Request-Id it came with), returned in the X-Request-Id header and attached as
 * req.id so errors can be matched to requests. In production each request is logged
 * as one JSON line; never bodies, query strings or tokens (no answers, no personal data).
 */
const production = () => process.env.NODE_ENV === "production";

export const requestLogger = (req, res, next) => {
  const incoming = String(req.headers["x-request-id"] || "");
  req.id = /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
  res.setHeader("X-Request-Id", req.id);
  if (process.env.NODE_ENV === "test" || req.path === "/api/health") return next();
  const started = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const entry = { level: res.statusCode >= 500 ? "error" : "info", requestId: req.id, method: req.method, path: req.baseUrl + req.path, status: res.statusCode, ms: Math.round(ms) };
    if (production()) console.log(JSON.stringify({ time: new Date().toISOString(), ...entry }));
    else if (ms > 1000 || res.statusCode >= 400) console.log(`[http] ${entry.method} ${entry.path} ${entry.status} ${entry.ms}ms (${req.id})`);
  });
  next();
};

/** One structured log line for an error (production) or a readable one (development). */
export const logError = (req, error) => {
  const entry = { level: "error", requestId: req?.id, path: req ? req.baseUrl + req.path : undefined, error: error?.message, code: error?.code };
  if (production()) console.error(JSON.stringify({ time: new Date().toISOString(), ...entry, stack: error?.stack?.split("\n").slice(0, 5).join(" | ") }));
  else console.error(`[error] ${entry.path || ""} ${entry.error} (${entry.requestId || "-"})`);
};
