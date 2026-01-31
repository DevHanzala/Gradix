// INSTRUCTOR ANALYTICS CONTROLLER - Request/Response Handler Layer
import {
  getInstructorExecutedAssessmentsService,
  getAssessmentStudentsService,
  getStudentAttemptQuestionsService,
  getInstructorOverviewService,
} from "../services/instructorAssessmentAnalytics.service.js";

// ==================== CONTROLLER FUNCTIONS ====================

// 1. GET INSTRUCTOR EXECUTED ASSESSMENTS
export const getInstructorExecutedAssessments = async (req, res) => {
  try {
    const instructorId = req.user?.id;

    const assessments = await getInstructorExecutedAssessmentsService(
      instructorId,
      req.user.role
    );

    res.status(200).json({
      success: true,
      message: assessments.length > 0 
        ? "Executed assessments retrieved successfully" 
        : "No executed assessments found",
      data: assessments,
    });
  } catch (error) {
    console.error("❌ Error fetching executed assessments:", error);

    if (error.message === "UNAUTHORIZED_ROLE") {
      return res.status(403).json({
        success: false,
        message: "Only instructors can access their assessments",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to fetch executed assessments",
      error: error.message,
    });
  }
};

// 2. GET ASSESSMENT STUDENTS
export const getAssessmentStudents = async (req, res) => {
  try {
    const assessmentId = parseInt(req.params.id);
    const instructorId = req.user?.id;

    const { data } = await getAssessmentStudentsService(
      assessmentId,
      instructorId,
      req.user.role
    );

    res.status(200).json({
      success: true,
      message: "Students retrieved successfully",
      data,
    });
  } catch (error) {
    console.error("Error fetching assessment students:", error);

    if (error.message === "INVALID_REQUEST") {
      return res.status(400).json({
        success: false,
        message: "Invalid request",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to fetch assessment students",
    });
  }
};

// 3. GET STUDENT ATTEMPT QUESTIONS
export const getStudentAttemptQuestions = async (req, res) => {
  try {
    const assessmentId = parseInt(req.params.id);
    const studentId = parseInt(req.params.studentId);
    const instructorId = req.user?.id;

    const questions = await getStudentAttemptQuestionsService(
      assessmentId,
      studentId,
      instructorId,
      req.user.role
    );

    res.status(200).json({
      success: true,
      message: questions.length > 0
        ? "Student questions retrieved successfully"
        : "No questions found for this student in the assessment",
      data: questions,
    });
  } catch (error) {
    console.error("❌ Error fetching student attempt questions:", error);

    if (error.message === "UNAUTHORIZED_ROLE") {
      return res.status(403).json({
        success: false,
        message: "Only instructors can access student data",
      });
    }

    if (error.message === "INVALID_IDS") {
      return res.status(400).json({
        success: false,
        message: "Invalid assessment ID or student ID",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to fetch student questions",
      error: error.message,
    });
  }
};


// 4. GET INSTRUCTOR DASHBOARD OVERVIEW
export const getInstructorOverview = async (req, res) => {
  try {
    const instructorId = req.user.id;

    const overview = await getInstructorOverviewService(instructorId);

    res.status(200).json({
      success: true,
      message: "Overview retrieved successfully",
      data: overview,
    });
  } catch (error) {
    console.error("❌ Error fetching instructor overview:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch overview",
      error: error.message,
    });
  }
};