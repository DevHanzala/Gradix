import express from "express";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import {
  startAssessmentForStudent,
  submitAssessmentForStudent,
  getSubmissionDetailsForStudent,
  getAssessmentForInstructorPrint,
} from "../controllers/studentAssessmentController.js";

const router = express.Router();
router.post("/assessments/:assessmentId/start", protect, authorizeRoles(["student"]), startAssessmentForStudent);
router.post("/assessments/:assessmentId/submit", protect, authorizeRoles(["student"]), submitAssessmentForStudent);
router.get("/submissions/:submissionId", protect, authorizeRoles(["student", "instructor", "admin", "super_admin"]), getSubmissionDetailsForStudent);
router.get("/assessments/:assessmentId/print", protect, authorizeRoles(["instructor", "admin", "super_admin"]), getAssessmentForInstructorPrint);

export default router;