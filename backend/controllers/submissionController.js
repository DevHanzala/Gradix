import {
  createSubmission,
  updateSubmission,
  findSubmissionByStudentAndAssignment,
  getSubmissionsByAssignment,
  getSubmissionsByStudent,
  gradeSubmission,
  deleteSubmission,
  getInstructorSubmissions,
  getAllSubmissions,
} from "../models/submissionModel.js"
import { findAssignmentById } from "../models/assignmentModel.js"
import { isStudentEnrolled } from "../models/courseModel.js"
import pool from "../DB/db.js"

/**
 * Creates or updates a submission (Student only).
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 */
export const submitAssignment = async (req, res) => {
  const { assignmentId, submissionFileUrl } = req.body
  const studentId = req.user.id

  try {
    console.log(`🔄 Submitting assignment ${assignmentId} by student ${studentId}`)

    // Validate required fields
    if (!assignmentId) {
      return res.status(400).json({ message: "Assignment ID is required." })
    }

    // Check if assignment exists
    const assignment = await findAssignmentById(assignmentId)
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found." })
    }

    // Check if student is enrolled in the course
    const isEnrolled = await isStudentEnrolled(studentId, assignment.course_id)
    if (!isEnrolled) {
      return res.status(403).json({ message: "You are not enrolled in this course." })
    }

    // Check if assignment is past due date
    if (assignment.due_date && new Date() > new Date(assignment.due_date)) {
      return res.status(400).json({ message: "Assignment submission deadline has passed." })
    }

    // Check if submission already exists
    const existingSubmission = await findSubmissionByStudentAndAssignment(studentId, assignmentId)

    let submission
    if (existingSubmission) {
      // Update existing submission
      submission = await updateSubmission(existingSubmission.id, submissionFileUrl)
      console.log(`✅ Submission updated successfully:`, submission)
    } else {
      // Create new submission
      submission = await createSubmission(studentId, assignmentId, submissionFileUrl)
      console.log(`✅ Submission created successfully:`, submission)
    }

    res.status(existingSubmission ? 200 : 201).json({
      message: existingSubmission ? "Submission updated successfully." : "Assignment submitted successfully.",
      submission,
    })
  } catch (error) {
    console.error("❌ Submit assignment error:", error)
    res.status(500).json({ message: "Server error while submitting assignment." })
  }
}

/**
 * Gets submissions for a specific assignment (Instructor/Admin only).
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 */
export const getAssignmentSubmissions = async (req, res) => {
  const { assignmentId } = req.params
  const userId = req.user.id
  const userRole = req.user.role

  try {
    console.log(`🔄 Fetching submissions for assignment ${assignmentId}`)

    // Check if assignment exists
    const assignment = await findAssignmentById(assignmentId)
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found." })
    }

    // Authorization check
    if (userRole === "instructor" && assignment.instructor_id !== userId) {
      return res.status(403).json({ message: "You can only view submissions for your own course assignments." })
    }

    const submissions = await getSubmissionsByAssignment(assignmentId)
    console.log(`✅ Found ${submissions.length} submissions for assignment`)

    res.status(200).json({
      submissions,
      assignment: {
        id: assignment.id,
        title: assignment.title,
        course_title: assignment.course_title,
        due_date: assignment.due_date,
      },
    })
  } catch (error) {
    console.error("❌ Get assignment submissions error:", error)
    res.status(500).json({ message: "Server error while fetching assignment submissions." })
  }
}

/**
 * Gets submissions by a student (Student only - their own submissions).
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 */
export const getStudentSubmissions = async (req, res) => {
  const studentId = req.user.id

  try {
    console.log(`🔄 Fetching submissions for student ${studentId}`)

    const submissions = await getSubmissionsByStudent(studentId)
    console.log(`✅ Found ${submissions.length} submissions for student`)

    res.status(200).json({
      submissions,
    })
  } catch (error) {
    console.error("❌ Get student submissions error:", error)
    res.status(500).json({ message: "Server error while fetching student submissions." })
  }
}

/**
 * Grades a submission (Instructor/Admin only).
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 */
export const gradeStudentSubmission = async (req, res) => {
  const { submissionId } = req.params
  const { grade, feedback } = req.body
  const userId = req.user.id
  const userRole = req.user.role

  try {
    console.log(`🔄 Grading submission ${submissionId}`)

    // Validate required fields
    if (!grade) {
      return res.status(400).json({ message: "Grade is required." })
    }

    // Find the submission with assignment details
    const submissionQuery = `
      SELECT s.*, a.course_id, c.instructor_id
      FROM submissions s
      JOIN assignments a ON s.assignment_id = a.id
      JOIN courses c ON a.course_id = c.id
      WHERE s.id = $1
    `
    const { rows } = await pool.query(submissionQuery, [submissionId])

    if (rows.length === 0) {
      return res.status(404).json({ message: "Submission not found." })
    }

    const submissionData = rows[0]

    // Authorization check
    if (userRole === "instructor" && submissionData.instructor_id !== userId) {
      return res.status(403).json({ message: "You can only grade submissions for your own course assignments." })
    }

    // Grade the submission
    const gradedSubmission = await gradeSubmission(submissionId, grade, feedback || "")
    console.log(`✅ Submission graded successfully:`, gradedSubmission)

    res.status(200).json({
      message: "Submission graded successfully.",
      submission: gradedSubmission,
    })
  } catch (error) {
    console.error("❌ Grade submission error:", error)
    res.status(500).json({ message: "Server error while grading submission." })
  }
}

/**
 * Gets a specific submission (with authorization check).
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 */
export const getSubmissionById = async (req, res) => {
  const { submissionId } = req.params
  const userId = req.user.id
  const userRole = req.user.role

  try {
    console.log(`🔄 Fetching submission ${submissionId}`)

    // Get submission with full details
    const submissionQuery = `
      SELECT s.*, u.name as student_name, u.email as student_email,
             a.title as assignment_title, a.due_date, c.title as course_title,
             c.instructor_id
      FROM submissions s
      JOIN users u ON s.student_id = u.id
      JOIN assignments a ON s.assignment_id = a.id
      JOIN courses c ON a.course_id = c.id
      WHERE s.id = $1
    `
    const { rows } = await pool.query(submissionQuery, [submissionId])

    if (rows.length === 0) {
      return res.status(404).json({ message: "Submission not found." })
    }

    const submission = rows[0]

    // Authorization check
    if (userRole === "student" && submission.student_id !== userId) {
      return res.status(403).json({ message: "You can only view your own submissions." })
    } else if (userRole === "instructor" && submission.instructor_id !== userId) {
      return res.status(403).json({ message: "You can only view submissions for your own course assignments." })
    }
    // Admins can view any submission

    console.log(`✅ Submission found:`, submission)

    res.status(200).json({
      submission,
    })
  } catch (error) {
    console.error("❌ Get submission by ID error:", error)
    res.status(500).json({ message: "Server error while fetching submission." })
  }
}

/**
 * Deletes a submission (Student only - their own submissions, before grading).
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 */
export const deleteStudentSubmission = async (req, res) => {
  const { submissionId } = req.params
  const studentId = req.user.id

  try {
    console.log(`🔄 Deleting submission ${submissionId} by student ${studentId}`)

    // Find the submission
    const submissionQuery = `
      SELECT s.*, a.due_date
      FROM submissions s
      JOIN assignments a ON s.assignment_id = a.id
      WHERE s.id = $1 AND s.student_id = $2
    `
    const { rows } = await pool.query(submissionQuery, [submissionId, studentId])

    if (rows.length === 0) {
      return res.status(404).json({ message: "Submission not found or you don't have permission to delete it." })
    }

    const submission = rows[0]

    // Check if submission has been graded
    if (submission.grade) {
      return res.status(400).json({ message: "Cannot delete a graded submission." })
    }

    // Check if assignment is past due date
    if (submission.due_date && new Date() > new Date(submission.due_date)) {
      return res.status(400).json({ message: "Cannot delete submission after the due date." })
    }

    // Delete the submission
    const deletedSubmission = await deleteSubmission(submissionId)
    console.log(`✅ Submission deleted successfully:`, deletedSubmission)

    res.status(200).json({
      message: "Submission deleted successfully.",
      submission: deletedSubmission,
    })
  } catch (error) {
    console.error("❌ Delete submission error:", error)
    res.status(500).json({ message: "Server error while deleting submission." })
  }
}

/**
 * Gets submissions for courses taught by an instructor (Instructor only).
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 */
export const getInstructorSubmissionsList = async (req, res) => {
  const instructorId = req.user.id

  try {
    console.log(`🔄 Fetching submissions for instructor ${instructorId}`)

    const submissions = await getInstructorSubmissions(instructorId)
    console.log(`✅ Found ${submissions.length} submissions for instructor`)

    res.status(200).json({
      submissions,
    })
  } catch (error) {
    console.error("❌ Get instructor submissions error:", error)
    res.status(500).json({ message: "Server error while fetching instructor submissions." })
  }
}

/**
 * Gets all submissions (Admin only).
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 */
export const getAllSubmissionsAdmin = async (req, res) => {
  try {
    console.log(`🔄 Fetching all submissions (admin)`)

    const submissions = await getAllSubmissions()
    console.log(`✅ Found ${submissions.length} total submissions`)

    res.status(200).json({
      submissions,
    })
  } catch (error) {
    console.error("❌ Get all submissions error:", error)
    res.status(500).json({ message: "Server error while fetching all submissions." })
  }
}
