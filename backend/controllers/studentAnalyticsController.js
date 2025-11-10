import {
  getStudentAnalytics,
  getPerformanceOverTime,
  getLearningRecommendations,
  getStudentAssessmentsList,
  getAssessmentAnalytics,
  getAssessmentQuestions as modelGetAssessmentQuestions
} from "../models/studentAnalyticsModel.js";

export const getStudentOverview = async (req, res) => {
  try {
    const studentId = req.user.id;

    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can access their analytics"
      });
    }

    console.log(`📊 Getting analytics overview for student ${studentId}`);

    const analytics = await getStudentAnalytics(studentId);

    res.status(200).json({
      success: true,
      message: "Student analytics retrieved successfully",
      data: analytics
    });
  } catch (error) {
    console.error("❌ Get student overview error:", error.stack || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve student analytics",
      error: error.message
    });
  }
};

export const getStudentPerformance = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { timeRange = 'month' } = req.query;

    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can access their performance data"
      });
    }

    console.log(`📈 Getting performance data for student ${studentId} (${timeRange})`);

    const performance = await getPerformanceOverTime(studentId, timeRange);

    res.status(200).json({
      success: true,
      message: "Performance data retrieved successfully",
      data: {
        time_range: timeRange,
        performance_data: performance
      }
    });
  } catch (error) {
    console.error("❌ Get student performance error:", error.stack || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve performance data",
      error: error.message
    });
  }
};

export const getStudentRecommendations = async (req, res) => {
  try {
    const studentId = req.user.id;

    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can access their recommendations"
      });
    }

    console.log(`🎯 Getting learning recommendations for student ${studentId}`);

    const recommendations = await getLearningRecommendations(studentId);

    res.status(200).json({
      success: true,
      message: "Learning recommendations retrieved successfully",
      data: recommendations
    });
  } catch (error) {
    console.error("❌ Get student recommendations error:", error.stack || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve learning recommendations",
      error: error.message
    });
  }
};

export const getStudentAssessments = async (req, res) => {
  try {
    const studentId = req.user.id;

    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can access their assessments"
      });
    }

    const assessments = await getStudentAssessmentsList(studentId);

    res.status(200).json({
      success: true,
      message: "Student assessments retrieved successfully",
      data: assessments
    });
  } catch (error) {
    console.error("❌ Get student assessments error:", error.stack || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve assessments",
      error: error.message
    });
  }
};

export const getAssessmentDetails = async (req, res) => {
  try {
    const studentId = req.user.id;
    const assessmentId = parseInt(req.params.id);

    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can access their assessment details"
      });
    }

    const details = await getAssessmentAnalytics(studentId, assessmentId);

    res.status(200).json({
      success: true,
      message: "Assessment details retrieved successfully",
      data: details
    });
  } catch (error) {
    console.error("❌ Get assessment details error:", error.stack || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve assessment details",
      error: error.message
    });
  }
};

export const getAssessmentQuestions = async (req, res) => {
  try {
    const studentId = req.user.id;
    const assessmentId = parseInt(req.params.id);

    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can access their assessment details"
      });
    }

    const questions = await modelGetAssessmentQuestions(studentId, assessmentId);

    res.status(200).json({
      success: true,
      message: "Assessment questions and answers retrieved successfully",
      data: questions
    });
  } catch (error) {
    console.error("❌ Get assessment questions error:", error.stack || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve assessment questions",
      error: error.message
    });
  }
};

export const getStudentReport = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { format = 'json', assessmentId } = req.query;

    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can access their reports"
      });
    }

    console.log(`📋 Generating detailed report for student ${studentId}${assessmentId ? ` (assessment ${assessmentId})` : ''}`);

    let report;
    if (assessmentId) {
      const details = await getAssessmentAnalytics(studentId, parseInt(assessmentId));
      report = {
        student_id: studentId,
        assessment_id: assessmentId,
        generated_at: new Date().toISOString(),
        score: details.score,
        total_marks: details.total_marks,
        student_score: details.student_score,
        weak_areas: details.weak_areas,
        recommendations: details.recommendations,
        summary: {
          score: details.score,
          total_marks: details.total_marks,
          student_score: details.student_score,
          improvement_areas: details.weak_areas.length
        }
      };
    } else {
      const [analytics, performance, recommendations] = await Promise.all([
        getStudentAnalytics(studentId),
        getPerformanceOverTime(studentId, 'month'),
        getLearningRecommendations(studentId)
      ]);

      report = {
        student_id: studentId,
        generated_at: new Date().toISOString(),
        overview: analytics,
        performance_trend: performance,
        recommendations: recommendations,
        summary: {
          total_assessments_completed: analytics.completed_assessments,
          average_performance: analytics.average_score,
          improvement_areas: recommendations.weak_areas.length,
          strengths_count: analytics.strengths.length
        }
      };
    }

    if (format === 'csv') {
      const csvData = convertToCSV(report, !!assessmentId);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="student-report${assessmentId ? `-${assessmentId}` : ''}.csv"`);
      return res.send(csvData);
    }

    res.status(200).json({
      success: true,
      message: "Student report generated successfully",
      data: report
    });
  } catch (error) {
    console.error("❌ Get student report error:", error.stack || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to generate student report",
      error: error.message
    });
  }
};

/**
 * Convert report data to CSV format
 */
const convertToCSV = (report, isSpecificAssessment = false) => {
  const headers = [
    'Metric',
    'Value',
    'Description'
  ];

  const rows = [];

  if (!isSpecificAssessment) {
    rows.push(['Total Assessments', report.overview.total_assessments, 'Number of completed assessments']);
    rows.push(['Average Score', `${report.overview.average_score}%`, 'Average performance across all assessments']);
    rows.push(['Total Time Spent', `${Math.round(report.overview.total_time_spent / 60)} minutes`, 'Total time spent on assessments']);
    rows.push(['Strengths', report.overview.strengths.length, 'Number of identified strengths']);
    rows.push(['Weaknesses', report.overview.weaknesses.length, 'Number of areas needing improvement']);
  } else {
    rows.push(['Score', `${report.score}%`, 'Performance score for this assessment']);
    rows.push(['Total Marks', `${report.total_marks}`, 'Maximum possible score for this assessment']);
    rows.push(['Student Score', `${report.student_score}`, 'Actual score achieved']);
  }

  rows.push(['Improvement Areas', report.summary.improvement_areas, 'Number of areas with recommendations']);

  // Add weak areas as additional rows if they exist
  if (report.weak_areas && report.weak_areas.length > 0) {
    report.weak_areas.forEach((area, index) => {
      rows.push([
        `Weak Area ${index + 1}`,
        area.topic,
        `Performance: ${area.performance}%, Suggestion: ${area.suggestion}`
      ]);
    });
  }

  return [
    headers.join(','),
    ...rows.map(row => row.map(field => `"${field}"`).join(','))
  ].join('\n');
};