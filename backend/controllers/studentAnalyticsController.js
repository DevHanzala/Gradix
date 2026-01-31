// STUDENT ANALYTICS CONTROLLER - Request/Response Handler Layer
import {
  getStudentOverviewService,
  getStudentPerformanceService,
  getStudentRecommendationsService,
  getStudentAssessmentsService,
  getAssessmentDetailsService,
  getAssessmentQuestionsService,
  getStudentReportService,
  getStudentAssessmentsListService,
} from "../services/studentAnalytics.service.js";

// ==================== CONTROLLER FUNCTIONS ====================

// 1. GET STUDENT OVERVIEW ANALYTICS
export const getStudentOverview = async (req, res) => {
  try {
    const studentId = req.user.id;

    const analytics = await getStudentOverviewService(studentId, req.user.role);

    res.status(200).json({
      success: true,
      message: "Student analytics retrieved successfully",
      data: analytics,
    });
  } catch (error) {
    console.error("❌ Get student overview error:", error.stack || error.message);

    if (error.message === "UNAUTHORIZED_ROLE") {
      return res.status(403).json({
        success: false,
        message: "Only students can access their analytics",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to retrieve student analytics",
      error: error.message,
    });
  }
};

// 2. GET STUDENT PERFORMANCE OVER TIME
export const getStudentPerformance = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { timeRange = "month" } = req.query;

    const performance = await getStudentPerformanceService(
      studentId,
      req.user.role,
      timeRange
    );

    res.status(200).json({
      success: true,
      message: "Performance data retrieved successfully",
      data: performance,
    });
  } catch (error) {
    console.error("❌ Get student performance error:", error.stack || error.message);

    if (error.message === "UNAUTHORIZED_ROLE") {
      return res.status(403).json({
        success: false,
        message: "Only students can access their performance data",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to retrieve performance data",
      error: error.message,
    });
  }
};

// 3. GET STUDENT LEARNING RECOMMENDATIONS
export const getStudentRecommendations = async (req, res) => {
  try {
    const studentId = req.user.id;

    const recommendations = await getStudentRecommendationsService(
      studentId,
      req.user.role
    );

    res.status(200).json({
      success: true,
      message: "Recommendations available only in report",
      data: recommendations,
    });
  } catch (error) {
    console.error("Get student recommendations error:", error);

    if (error.message === "UNAUTHORIZED_ROLE") {
      return res.status(403).json({
        success: false,
        message: "Only students can access their recommendations",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to retrieve recommendations",
    });
  }
};

// 4. GET STUDENT ASSESSMENTS
export const getStudentAssessments = async (req, res) => {
  try {
    const studentId = req.user.id;

    const { data } = await getStudentAssessmentsService(studentId, req.user.role);

    res.status(200).json({
      success: true,
      message: "Student assessments retrieved successfully",
      data,
    });
  } catch (error) {
    console.error("Get student assessments error:", error);

    if (error.message === "UNAUTHORIZED_ROLE") {
      return res.status(403).json({
        success: false,
        message: "Only students can access their assessments",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to retrieve assessments",
    });
  }
};

// 5. GET DETAILED ASSESSMENT ANALYTICS
export const getAssessmentDetails = async (req, res) => {
  try {
    const studentId = req.user.id;
    const assessmentId = parseInt(req.params.id);

    const details = await getAssessmentDetailsService(
      studentId,
      assessmentId,
      req.user.role
    );

    res.status(200).json({
      success: true,
      message: "Assessment details retrieved successfully",
      data: details,
    });
  } catch (error) {
    console.error("❌ Get assessment details error:", error.stack || error.message);

    if (error.message === "UNAUTHORIZED_ROLE") {
      return res.status(403).json({
        success: false,
        message: "Only students can access their assessment details",
      });
    }

    if (error.message === "No completed attempt found for this assessment") {
      return res.status(404).json({
        success: false,
        message: "No completed attempt found for this assessment",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to retrieve assessment details",
      error: error.message,
    });
  }
};

// 6. GET ASSESSMENT QUESTIONS AND ANSWERS
export const getAssessmentQuestions = async (req, res) => {
  try {
    const studentId = req.user.id;
    const assessmentId = parseInt(req.params.id);

    const questions = await getAssessmentQuestionsService(
      studentId,
      assessmentId,
      req.user.role
    );

    res.status(200).json({
      success: true,
      message: "Assessment questions and answers retrieved successfully",
      data: questions,
    });
  } catch (error) {
    console.error("❌ Get assessment questions error:", error.stack || error.message);

    if (error.message === "UNAUTHORIZED_ROLE") {
      return res.status(403).json({
        success: false,
        message: "Only students can access their assessment details",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to retrieve assessment questions",
      error: error.message,
    });
  }
};

// 7. GENERATE DETAILED STUDENT REPORT WITH AI RECOMMENDATIONS
export const getStudentReport = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { format = "json", assessmentId } = req.query;

    const result = await getStudentReportService(
      studentId,
      req.user.role,
      format,
      assessmentId
    );

    if (result.format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="student-report${result.assessmentId ? `-${result.assessmentId}` : ""}.csv"`
      );
      return res.send(result.data);
    }

    res.status(200).json({
      success: true,
      message: "Student report generated successfully",
      data: result.data,
    });
  } catch (error) {
    console.error("❌ Get student report error:", error.stack || error.message);

    if (error.message === "UNAUTHORIZED_ROLE") {
      return res.status(403).json({
        success: false,
        message: "Only students can access their reports",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to generate student report",
      error: error.message,
    });
  }
};


//8. GET STUDENT ASSESSMENTS LIST
export const getStudentAssessmentsList = async (req, res) => {
  try {
    const studentId = req.user.id;

    const data = await getStudentAssessmentsListService(studentId);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("❌ getStudentAssessmentsList error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load student assessments",
    });
  }
};