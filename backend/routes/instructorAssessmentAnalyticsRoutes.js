import express from "express";
import {
  getInstructorExecutedAssessments,
  getAssessmentStudents,
  getStudentAttemptQuestions,
  getInstructorOverview,
} from "../controllers/InstructorAssessmentAnalyticsController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import { getInsightsService, exportInsightsService } from "../services/insights.service.js";

const router = express.Router();

/**
 * @route GET /api/instructor-analytics/assessments
 * @desc Retrieve instructor's executed assessments
 * @access Private (Instructor)
 */
router.get("/assessments", protect, authorizeRoles("instructor"), getInstructorExecutedAssessments);

/**
 * @route GET /api/instructor-analytics/assessment/:id/students
 * @desc Get students who completed a specific assessment
 * @access Private (Instructor)
 */
router.get("/assessment/:id/students", protect, authorizeRoles("instructor"), getAssessmentStudents);

/**
 * @route GET /api/instructor-analytics/assessment/:id/student/:studentId/questions
 * @desc Get a student's questions and answers for a specific assessment
 * @access Private (Instructor)
 */
router.get("/assessment/:id/student/:studentId/questions", protect, authorizeRoles("instructor"), getStudentAttemptQuestions);

/**
 * @route   GET /api/instructor-analytics
 * @desc    Get instructor dashboard overview
 * @access  Private (Instructor, Admin, Super Admin)
 */

/** Objective accuracy, hardest objectives, score distribution, difficulty reached. */
router.get("/assessment/:id/insights", protect, authorizeRoles("instructor", "super_admin"), async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await getInsightsService(req.params.id, req.user) });
  } catch (error) {
    next(error);
  }
});

/** Per-student results as CSV (default) or Excel (?format=xlsx). */
router.get("/assessment/:id/export", protect, authorizeRoles("instructor", "super_admin"), async (req, res, next) => {
  try {
    const { buffer, contentType, extension } = await exportInsightsService(req.params.id, req.user, req.query.format === "xlsx" ? "xlsx" : "csv");
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="gradix-results-${req.params.id}.${extension}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

router.get(
  "/",
  protect,
  authorizeRoles("instructor"),
  getInstructorOverview
);

export default router;