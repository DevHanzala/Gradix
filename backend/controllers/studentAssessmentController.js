import {
  startAssessmentForStudentService,
  submitAssessmentForStudentService,
  getSubmissionDetailsForStudentService,
  getAssessmentForInstructorPrintService,
} from "../services/studentAssessment.service.js";

// ==================== CONTROLLER FUNCTIONS ====================

// 1. START ASSESSMENT FOR STUDENT
export const startAssessmentForStudent = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { assessmentId } = req.params;
    const { language = "en" } = req.body || {};

    const result = await startAssessmentForStudentService(
      studentId,
      assessmentId,
      language
    );

    res.status(200).json({
      success: true,
      message: "Assessment started successfully",
      data: result,
    });
  } catch (error) {
    console.error("❌ startAssessmentForStudent error:", error.message, error.stack);

    if (error.message === "ASSESSMENT_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
      });
    }

    if (error.message === "NOT_ENROLLED") {
      return res.status(403).json({
        success: false,
        message: "You are not enrolled for this assessment",
      });
    }

    if (error.message === "ALREADY_IN_PROGRESS") {
      return res.status(400).json({
        success: false,
        message: "Assessment already in progress",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to start assessment",
    });
  }
};

// 2. SUBMIT ASSESSMENT FOR STUDENT
export const submitAssessmentForStudent = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { assessmentId } = req.params;
    const { attemptId, answers } = req.body;

    const result = await submitAssessmentForStudentService(
      studentId,
      assessmentId,
      attemptId,
      answers
    );

    res.status(200).json({
      success: true,
      message: "Assessment submitted successfully",
      data: result,
    });
  } catch (error) {
    console.error("submitAssessmentForStudent error:", error);

    if (error.message === "INVALID_ATTEMPT") {
      return res.status(400).json({
        success: false,
        message: "Invalid attempt or assessment not in progress",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to submit assessment",
    });
  }
};

// 3. GET SUBMISSION DETAILS FOR STUDENT
export const getSubmissionDetailsForStudent = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { submissionId } = req.params;

    const details = await getSubmissionDetailsForStudentService(
      studentId,
      submissionId
    );

    res.status(200).json({
      success: true,
      message: "Submission details retrieved successfully",
      data: details,
    });
  } catch (error) {
    console.error("❌ getSubmissionDetailsForStudent error:", error.message, error.stack);

    if (error.message === "SUBMISSION_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to retrieve submission details",
    });
  }
};

// 4. GENERATE ASSESSMENT DATA FOR PHYSICAL PAPER PRINTING
export const getAssessmentForInstructorPrint = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const userId = req.user.id;

    const result = await getAssessmentForInstructorPrintService(
      assessmentId,
      userId
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("getAssessmentForInstructorPrint error:", error);

    if (error.message === "ASSESSMENT_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Assessment not found or access denied",
      });
    }

    if (error.message === "NO_QUESTION_BLOCKS") {
      return res.status(400).json({
        success: false,
        message: "No question blocks defined for this assessment",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to generate paper data",
    });
  }
};