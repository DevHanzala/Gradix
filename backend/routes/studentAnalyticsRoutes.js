// routes/studentAnalyticsRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getStudentOverview,
  getStudentPerformance,
  getStudentRecommendations,
  getStudentAssessments,
  getAssessmentDetails,
  getAssessmentQuestions,
  getStudentReport
} from "../controllers/studentAnalyticsController.js";

const router = express.Router();

router.use(protect);

router.get("/overview", getStudentOverview);
router.get("/performance", getStudentPerformance);
router.get("/recommendations", getStudentRecommendations);
router.get("/assessments", getStudentAssessments);
router.get("/assessment/:id", getAssessmentDetails);
router.get("/assessment/:id/questions", getAssessmentQuestions);
router.get("/report", getStudentReport);

export default router;