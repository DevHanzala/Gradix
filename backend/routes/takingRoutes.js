import express from "express";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import {
  startAssessmentForStudent,
  submitAssessmentForStudent,
  getSubmissionDetailsForStudent,
  getAssessmentForInstructorPrint,
} from "../controllers/takingController.js";
import { getStudentAssessmentsList } from "../controllers/takingListController.js";

const router = express.Router();

// Student taking routes
router.get("/assessments", protect, authorizeRoles(["student"]), getStudentAssessmentsList);
router.post("/assessments/:assessmentId/start", protect, authorizeRoles(["student"]), startAssessmentForStudent);
router.post("/assessments/:assessmentId/submit", protect, authorizeRoles(["student"]), submitAssessmentForStudent);
router.get("/submissions/:submissionId", protect, authorizeRoles(["student", "instructor", "admin", "super_admin"]), getSubmissionDetailsForStudent);

// Instructor print data (student cannot access)
router.get("/assessments/:assessmentId/print", protect, authorizeRoles(["instructor", "admin", "super_admin"]), getAssessmentForInstructorPrint);

export default router;