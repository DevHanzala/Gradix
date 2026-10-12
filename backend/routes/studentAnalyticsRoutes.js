import express from "express";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import {
  getStudentOverview,
  getStudentPerformance,
  getStudentRecommendations,
  getStudentAssessments,
  getAssessmentDetails,
  getAssessmentQuestions,
  getStudentReport,
} from "../controllers/studentAnalyticsController.js";
import { aiLimiter } from "../middleware/rateLimiters.js";

const router = express.Router();

router.use(protect, authorizeRoles("student"));
router.get("/overview", getStudentOverview);
router.get("/performance", getStudentPerformance);
router.get("/recommendations", getStudentRecommendations);
router.get("/assessments", getStudentAssessments);
router.get("/assessment/:id", getAssessmentDetails);
router.get("/assessment/:id/questions", getAssessmentQuestions);
router.get("/report", aiLimiter, getStudentReport);

export default router;