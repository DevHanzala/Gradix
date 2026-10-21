import express from "express";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import {
  getStudentAssessments,
  getResults,
  getStudyPlan,
  createPractice,
  checkPracticeAnswer,
  downloadReport,
} from "../controllers/studentAnalyticsController.js";
import { aiLimiter } from "../middleware/rateLimiters.js";

const router = express.Router();

router.use(protect, authorizeRoles("student"));

router.get("/assessments", getStudentAssessments);
// Learning pathways (completed attempts only).
router.get("/results/:assessmentId", getResults);
router.post("/results/:assessmentId/study-plan", aiLimiter, getStudyPlan);
router.get("/results/:assessmentId/report.pdf", aiLimiter, downloadReport);
router.post("/results/:assessmentId/practice", aiLimiter, createPractice);
router.post("/practice/:sessionId/check", checkPracticeAnswer);

export default router;
