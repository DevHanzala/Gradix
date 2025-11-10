import express from "express";
import {
  getInstructorExecutedAssessments,
  getAssessmentStudents,
  getStudentAttemptQuestions
} from "../controllers/InstructorAssessmentAnalyticsController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @route GET /api/instructor-analytics/assessments
 * @desc Retrieve instructor's executed assessments
 * @access Private (Instructor)
 */
router.get("/assessments", protect, getInstructorExecutedAssessments);

/**
 * @route GET /api/instructor-analytics/assessment/:id/students
 * @desc Get students who completed a specific assessment
 * @access Private (Instructor)
 */
router.get("/assessment/:id/students", protect, getAssessmentStudents);

/**
 * @route GET /api/instructor-analytics/assessment/:id/student/:studentId/questions
 * @desc Get a student's questions and answers for a specific assessment
 * @access Private (Instructor)
 */
router.get("/assessment/:id/student/:studentId/questions", protect, getStudentAttemptQuestions);

export default router;