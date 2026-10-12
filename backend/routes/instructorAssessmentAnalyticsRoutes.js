import express from "express";
import {
  getInstructorExecutedAssessments,
  getAssessmentStudents,
  getStudentAttemptQuestions,
  getInstructorOverview,
} from "../controllers/InstructorAssessmentAnalyticsController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";

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

router.get(
  "/",
  protect,
  authorizeRoles("instructor"),
  getInstructorOverview
);

export default router;