import express from "express"
import { protect, authorizeRoles } from "../middleware/authMiddleware.js"
import { getQuestionsRequiringManualGrading, overrideGrading } from "../services/autoGradingService.js"

const router = express.Router()

// Protect all routes
router.use(protect)

/**
 * @route   GET /api/auto-grading/manual-grading/:assessmentId
 * @desc    Get questions requiring manual grading for a specific assessment
 * @access  Private (Instructor only)
 */
router.get("/manual-grading/:assessmentId", authorizeRoles("instructor"), async (req, res) => {
  try {
    const { assessmentId } = req.params
    
    // Get questions requiring manual grading
    const manualGradingQuestions = await getQuestionsRequiringManualGrading(parseInt(assessmentId))
    
    res.json({
      success: true,
      message: "Manual grading questions retrieved successfully",
      data: manualGradingQuestions
    })

  } catch (error) {
    console.error("Get manual grading questions error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to retrieve manual grading questions",
      error: error.message
    })
  }
})

/**
 * @route   POST /api/auto-grading/override
 * @desc    Override auto-graded score for a specific question
 * @access  Private (Instructor only)
 */
router.post("/override", authorizeRoles("instructor"), async (req, res) => {
  try {
    const { answer_id, new_score, feedback, override_reason, instructor_id } = req.body
    
    if (!answer_id || new_score === undefined || !override_reason) {
      return res.status(400).json({
        success: false,
        message: "Answer ID, new score, and override reason are required"
      })
    }

    // Override the grade
    const result = await overrideGrading(
      parseInt(answer_id), 
      parseFloat(new_score), 
      feedback, 
      override_reason, 
      instructor_id || req.user.id
    )
    
    res.json({
      success: true,
      message: "Grade overridden successfully",
      data: result
    })

  } catch (error) {
    console.error("Grade override error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to override grade",
      error: error.message
    })
  }
})

/**
 * @route   GET /api/auto-grading/status
 * @desc    Get auto-grading service status
 * @access  Private (Instructor only)
 */
router.get("/status", authorizeRoles("instructor"), async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Auto-grading Service is running",
      data: {
        status: "operational",
        service: "Auto-grading Engine",
        features: ["MCQ Auto-grading", "Rubric-based Grading", "Grade Override"],
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Auto-grading service status check failed",
      error: error.message
    })
  }
})

export default router
