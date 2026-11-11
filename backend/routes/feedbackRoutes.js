import express from "express";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import db from "../DB/db.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import { findUserByEmail } from "../models/userModel.js";
import { AppError } from "../utils/AppError.js";

/**
 * In-app feedback (signed-in users) and the public contact form (landing page).
 * Both are stored for the Super Admin; nothing is emailed or sent elsewhere.
 */
const router = express.Router();
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 1000 : 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ success: false, code: "RATE_LIMITED", message: "Too many messages. Try again later." }),
});

const clean = (value, max) =>
  String(value ?? "")
    .normalize("NFC")
    // Drop control characters except new lines and tabs.
    .replace(/\p{Cc}/gu, (c) => (c === "\n" || c === "\t" ? c : ""))
    .trim()
    .slice(0, max);

const signedInUser = async (req) => {
  try {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) return null;
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    return (await findUserByEmail(decoded.email)) || null;
  } catch {
    return null;
  }
};

router.post("/", limiter, async (req, res, next) => {
  try {
    const user = await signedInUser(req);
    const kind = req.body?.kind === "contact" ? "contact" : "feedback";
    const message = clean(req.body?.message, 4000);
    if (message.length < 3) throw new AppError("FEEDBACK_EMPTY", 400, "Write a message first.");
    const name = clean(req.body?.name ?? user?.name, 120) || null;
    const email = clean(req.body?.email ?? user?.email, 200) || null;
    if (kind === "contact" && (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new AppError("FEEDBACK_EMAIL", 400, "Enter a valid email address.");
    if (kind === "feedback" && !user) throw new AppError("UNAUTHORIZED", 401, "Sign in to send feedback.");
    const { rows } = await db.query(
      `INSERT INTO feedback (kind, user_id, name, email, message, page, language) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
      [kind, user?.id ?? null, name, email, message, clean(req.body?.page, 300) || null, clean(req.body?.language, 10) || null]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.get("/", protect, authorizeRoles("super_admin"), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT f.id, f.kind, f.name, f.email, f.message, f.page, f.language, f.status, f.created_at, u.role AS user_role
       FROM feedback f LEFT JOIN users u ON u.id = f.user_id ORDER BY f.created_at DESC LIMIT 200`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", protect, authorizeRoles("super_admin"), async (req, res, next) => {
  try {
    const status = ["new", "read", "done"].includes(req.body?.status) ? req.body.status : null;
    if (!status) throw new AppError("INVALID_STATUS", 400, "Unknown status.");
    const { rows } = await db.query(`UPDATE feedback SET status = $2 WHERE id = $1 RETURNING id, status`, [Number.parseInt(req.params.id, 10) || 0, status]);
    if (!rows[0]) throw new AppError("NOT_FOUND", 404, "Not found.");
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
});

export default router;
