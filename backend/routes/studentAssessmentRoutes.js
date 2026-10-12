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

const router = express.Router();

router.use(protect, authorizeRoles("student"));

router.get("/assessments/:assessmentId/attempt", getAttemptState);
router.post("/assessments/:assessmentId/start", aiLimiter, startAssessmentForStudent);
router.post("/assessments/:assessmentId/submit", submitAssessmentForStudent);
router.put("/attempts/:attemptId/answers/:questionId", saveAnswer);
router.post("/attempts/:attemptId/advance", advanceQuestion);
router.get("/submissions/:submissionId", getSubmissionDetailsForStudent);

export default router;
