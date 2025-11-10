import express from "express"
import { protect, authorizeRoles } from "../middleware/authMiddleware.js"
import { generateQuestionsForBlock, getAuditLogs } from "../services/aiQuestionGenerationService.js"

const router = express.Router()

// Protect all routes
router.use(protect)

/**
 * @route   POST /api/ai-generation/generate
 * @desc    Generate questions using AI for a specific assessment
 * @access  Private (Instructor only)
 */
router.post("/generate", authorizeRoles("instructor"), async (req, res) => {
  try {
    const { assessment_id, block_config } = req.body
    
    if (!assessment_id || !block_config) {
      return res.status(400).json({
        success: false,
        message: "Assessment ID and block configuration are required"
      })
    }

    // Generate questions using AI service
    const result = await generateQuestionsForBlock(block_config, assessment_id, req.user.id)
    
    res.json({
      success: true,
      message: "Questions generated successfully",
      data: {
        questions: result.questions,
        block_title: block_config.block_title,
        total_questions: result.questions.length,
        generation_time: result.generation_time,
        ai_model_used: result.ai_model_used
      }
    })

  } catch (error) {
    console.error("AI Generation error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to generate questions",
      error: error.message
    })
  }
})

/**
 * @route   GET /api/ai-generation/audit-logs/:assessmentId
 * @desc    Get AI generation audit logs for a specific assessment
 * @access  Private (Instructor only)
 */
router.get("/audit-logs/:assessmentId", authorizeRoles("instructor"), async (req, res) => {
  try {
    const { assessmentId } = req.params
    
    // Get audit logs from service
    const auditLogs = await getAuditLogs(parseInt(assessmentId))
    
    res.json({
      success: true,
      message: "Audit logs retrieved successfully",
      data: auditLogs
    })

  } catch (error) {
    console.error("Get audit logs error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to retrieve audit logs",
      error: error.message
    })
  }
})

/**
 * @route   GET /api/ai-generation/status
 * @desc    Get AI service status and health check
 * @access  Private (Instructor only)
 */
router.get("/status", authorizeRoles("instructor"), async (req, res) => {
  try {
    res.json({
      success: true,
      message: "AI Generation Service is running",
      data: {
        status: "operational",
        service: "Google Generative AI",
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "AI service status check failed",
      error: error.message
    })
  }
})

export default router
