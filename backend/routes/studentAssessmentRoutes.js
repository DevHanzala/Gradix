import express from "express";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import {
  getAttemptState,
  startAssessmentForStudent,
  saveAnswer,
  advanceQuestion,
  submitAssessmentForStudent,
  getSubmissionDetailsForStudent,
} from "../controllers/studentAssessmentController.js";
import { aiLimiter } from "../middleware/rateLimiters.js";
import { recordAttemptEventService } from "../services/studentAssessment.service.js";

const router = express.Router();

router.use(protect, authorizeRoles("student"));

router.get("/assessments/:assessmentId/attempt", getAttemptState);
router.post("/assessments/:assessmentId/start", aiLimiter, startAssessmentForStudent);
router.post("/assessments/:assessmentId/submit", submitAssessmentForStudent);
router.put("/attempts/:attemptId/answers/:questionId", saveAnswer);
router.post("/attempts/:attemptId/advance", advanceQuestion);
// Proctoring events from the browser (tab switch, fullscreen exit, copy/paste/right-click).
router.post("/attempts/:attemptId/events", async (req, res, next) => {
  try {
    res.json({ success: true, data: await recordAttemptEventService(req.user.id, req.params.attemptId, req.body || {}) });
  } catch (error) {
    next(error);
  }
});
router.get("/submissions/:submissionId", getSubmissionDetailsForStudent);

export default router;
