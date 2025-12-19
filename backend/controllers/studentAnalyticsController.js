import {
  getStudentAnalytics,
  getPerformanceOverTime,
  getLearningRecommendations,
  getStudentAssessmentsList,
  getAssessmentAnalytics,
  getAssessmentQuestions as modelGetAssessmentQuestions
} from "../models/studentAnalyticsModel.js";
import { redis } from "../services/redis.js";
import { getCreationModel, generateContent } from "../services/geminiService.js";

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
    res.status(200).json({
      success: true,
      message: "Recommendations available only in report",
      data: {
        weak_areas: [],
        study_plan: { daily_practice: [], weekly_review: [] },
        next_assessments: []
      }
    });
  } catch (error) {
    console.error("Get student recommendations error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve recommendations"
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

    // REDIS CACHE KEY
    const cacheKey = `student:assessments:list:${studentId}`;

    // CHECK REDIS FIRST — INSTANT LOAD
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`Student assessments from Redis for student ${studentId}`);
      return res.status(200).json({
        success: true,
        message: "Student assessments retrieved successfully",
        data: cached
      });
    }

    console.log(`Fetching assessments from DB for student ${studentId}`);
    const assessments = await getStudentAssessmentsList(studentId);

    // CACHE FOR 10 MINUTES
    await redis.set(cacheKey, assessments, { ex: 600 });

    res.status(200).json({
      success: true,
      message: "Student assessments retrieved successfully",
      data: assessments
    });
  } catch (error) {
    console.error("Get student assessments error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve assessments"
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
    if (error.message === 'No completed attempt found for this assessment') {
      res.status(404).json({
        success: false,
        message: "No completed attempt found for this assessment"
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to retrieve assessment details",
        error: error.message
      });
    }
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

// UPDATE IN studentAnalyticsController.js — ADD AI TO getStudentReport

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
      // Fetch basic details
      const details = await getAssessmentAnalytics(studentId, parseInt(assessmentId));

      // GENERATE RECOMMENDATIONS WITH AI — COMPULSORY FOR REPORT
      const client = await getCreationModel();
      const weakQuestionsJson = JSON.stringify(details.weak_questions || []);
      const prompt = `You are an educational AI assistant. Generate learning recommendations for the assessment "${details.assessment_title}" with score ${details.score || 0}%. Weak questions: ${weakQuestionsJson}. If no weak questions, provide general recommendations. Respond ONLY with valid JSON: { "weak_areas": [{ "topic": "string", "performance": number, "suggestion": "string" }], "study_plan": { "daily_practice": [{ "topic": "string", "focus": "string", "time_allocation": "string" }], "weekly_review": [{ "topic": "string", "activity": "string", "goal": "string" }] } }.`;

      let responseText = await generateContent(client, prompt, {
        generationConfig: { maxOutputTokens: 1000, temperature: 0.7, response_mime_type: 'application/json' },
      });

      responseText = responseText.replace(/^```json\n/, '').replace(/\n```$/, '').trim();

      let recommendations = {
        weak_areas: [],
        study_plan: { daily_practice: [], weekly_review: [] }
      };

      try {
        recommendations = JSON.parse(responseText);
      } catch (parseError) {
        console.error("AI recommendation parse error:", parseError);
        recommendations = {
          weak_areas: details.weak_questions?.map(area => ({
            topic: area.question_type || 'General',
            performance: Math.round((area.performance || 0) * 100),
            suggestion: "Practice more in this area."
          })) || [],
          study_plan: {
            daily_practice: [{ topic: "General", focus: "Review basics", time_allocation: "30 minutes" }],
            weekly_review: [{ topic: "All", activity: "Mock test", goal: "Improve by 10%" }]
          }
        };
      }

      // Build report with recommendations
      report = {
  student_id: studentId,
  assessment_id: assessmentId,
  generated_at: new Date().toISOString(),
  score: details.score,
  total_marks: details.total_marks,
  student_score: details.student_score,
  time_taken: details.time_taken,
  total_questions: details.total_questions,
  correct_answers: details.correct_answers,
  incorrect_answers: details.incorrect_answers,
  negative_marks_applied: details.negative_marks_applied || 0, // make sure this is here
  student_answers: details.student_answers || [], // ADD THIS LINE
  recommendations,
  title: details.assessment_title
};

console.log("=== REPORT DEBUG ===");
console.log("details from getAssessmentAnalytics:", details);
console.log("negative_marks_applied from details:", details.negative_marks_applied);
console.log("Final report sent:", report);
console.log("negative_marks_applied in report:", report.negative_marks_applied);
console.log("=== END DEBUG ===");

    } else {
      // General report (no changes)
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