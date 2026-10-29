import express from "express";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import { findUserByEmail } from "../models/userModel.js";
import {
  createSessionService,
  listSessionsService,
  getHostViewService,
  controlService,
  removeParticipantService,
  exportCsvService,
  lookupCodeService,
  joinService,
  participantStateService,
  answerService,
  nextQuestionService,
  ownSession,
  loadParticipant,
  verifyParticipantToken,
} from "../services/live/live.service.js";
import { openPollService, closePollService, respondPollService, setParticipantTeamService } from "../services/live/engagement.service.js";

/**
 * Live classroom sessions.
 *  Teacher (login):   /api/live/sessions...
 *  Participant:       /api/live/join (code + nickname, or the login of a signed-in user),
 *                     then /api/live/me... with the X-Live-Token header from the join.
 */
const router = express.Router();
const teacher = [protect, authorizeRoles(["instructor", "admin", "super_admin"])];

const handle =
  (fn, status = 200) =>
  async (req, res, next) => {
    try {
      res.status(status).json({ success: true, data: await fn(req) });
    } catch (error) {
      next(error);
    }
  };

// A whole class often shares one school IP, so this is per IP but generous.
const joinLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 10000 : 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ success: false, code: "RATE_LIMITED", message: "Too many attempts. Wait a minute and try again." }),
});

/** A signed-in user joins with their account; a missing or invalid login simply means "guest". */
const optionalUser = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    if (header.startsWith("Bearer ")) {
      const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
      const user = await findUserByEmail(decoded.email);
      if (user) req.user = { id: user.id, role: user.role, name: user.name };
    }
  } catch {
    // Treated as a guest.
  }
  next();
};

const liveToken = (req) => req.headers["x-live-token"];

// ------------------------------------------------------------- teacher

router.post("/sessions", ...teacher, handle((req) => createSessionService(req.user, req.body), 201));
router.get("/sessions", ...teacher, handle((req) => listSessionsService(req.user)));
router.get("/sessions/:id", ...teacher, handle((req) => getHostViewService(req.params.id, req.user)));
router.post("/sessions/:id/control", ...teacher, handle((req) => controlService(req.params.id, req.user, req.body?.action)));
router.delete("/sessions/:id/participants/:participantId", ...teacher, handle((req) => removeParticipantService(req.params.id, req.user, req.params.participantId)));
router.post("/sessions/:id/polls", ...teacher, handle(async (req) => openPollService(await ownSession(req.params.id, req.user), req.body), 201));
router.post("/sessions/:id/polls/:pollId/close", ...teacher, handle(async (req) => closePollService(await ownSession(req.params.id, req.user), req.params.pollId)));
router.put(
  "/sessions/:id/participants/:participantId/team",
  ...teacher,
  handle(async (req) => {
    await setParticipantTeamService(await ownSession(req.params.id, req.user), req.params.participantId, req.body?.team);
    return getHostViewService(req.params.id, req.user);
  })
);
router.get("/sessions/:id/export.csv", ...teacher, async (req, res, next) => {
  try {
    const { filename, csv } = await exportCsvService(req.params.id, req.user);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

// --------------------------------------------------------- participant

router.get("/join/:code", joinLimiter, handle((req) => lookupCodeService(req.params.code)));
router.post("/join", joinLimiter, optionalUser, handle((req) => joinService({ code: req.body?.code, nickname: req.body?.nickname, user: req.user || null }), 201));
router.get("/me", handle((req) => participantStateService(liveToken(req))));
router.post("/me/answer", handle((req) => answerService(liveToken(req), { index: req.body?.index, answer: req.body?.answer })));
router.post("/me/next", handle((req) => nextQuestionService(liveToken(req))));
router.post(
  "/me/poll",
  handle(async (req) => respondPollService(await loadParticipant(verifyParticipantToken(liveToken(req))), { pollId: req.body?.pollId, answer: req.body?.answer }))
);

export default router;
