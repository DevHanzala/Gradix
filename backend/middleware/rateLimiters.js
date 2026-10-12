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
