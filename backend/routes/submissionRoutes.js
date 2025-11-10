import { Router } from "express"
import {
  submitAssignment,
  getAssignmentSubmissions,
  getStudentSubmissions,
  gradeStudentSubmission,
  getSubmissionById,
  deleteStudentSubmission,
  getInstructorSubmissionsList,
  getAllSubmissionsAdmin,
} from "../controllers/submissionController.js"
import { protect, authorizeRoles } from "../middleware/authMiddleware.js"

const router = Router()

// Submission management routes
router.post("/", protect, authorizeRoles("student"), submitAssignment)
router.get("/assignment/:assignmentId", protect, authorizeRoles("instructor", "admin"), getAssignmentSubmissions)
router.get("/:submissionId", protect, getSubmissionById)
router.delete("/:submissionId", protect, authorizeRoles("student"), deleteStudentSubmission)

// Grading routes (Instructor/Admin only)
router.put("/:submissionId/grade", protect, authorizeRoles("instructor", "admin"), gradeStudentSubmission)

// Student routes
router.get("/student/list", protect, authorizeRoles("student"), getStudentSubmissions)

// Instructor routes
router.get("/instructor/list", protect, authorizeRoles("instructor"), getInstructorSubmissionsList)

// Admin routes
router.get("/admin/all", protect, authorizeRoles("admin"), getAllSubmissionsAdmin)

export default router
