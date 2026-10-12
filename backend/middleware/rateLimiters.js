import rateLimit from "express-rate-limit";

const isTest = process.env.NODE_ENV === "test";

const json429 = (message) => (req, res) =>
  res.status(429).json({ success: false, code: "RATE_LIMITED", message });

/**
 * Strict limiter for unauthenticated auth endpoints (login, signup,
 * google-auth, forgot-password, verify). Keyed by IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isTest ? 1000 : 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: json429("Too many attempts. Please try again in a few minutes."),
});

/**
 * Per-user limiter for endpoints that call the LLM (question preview, paper
 * printing, starting an exam, AI reports). Must run after `protect`.
 */
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isTest ? 1000 : 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => `user:${req.user?.id ?? "anonymous"}`,
  handler: json429("Too many AI requests. Please wait a few minutes and try again."),
});
