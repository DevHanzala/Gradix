import {
  getStudentAnalytics,
  getPerformanceOverTime,
  getLearningRecommendations,
  getAssessmentAnalytics,
  getAssessmentQuestions as modelGetAssessmentQuestions,
} from "../models/studentAnalyticsModel.js";
import { findEnrolledAssessmentsWithStatusQuery } from "../repositories/studentAnalyticsRepository.js";
import { generateContent } from "./ai/generateContent.js";

// ==================== SERVICE FUNCTIONS ====================

// 1. GET STUDENT OVERVIEW SERVICE
export const getStudentOverviewService = async (studentId, userRole) => {
  if (userRole !== "student") {
    throw new Error("UNAUTHORIZED_ROLE");
  }

  const analytics = await getStudentAnalytics(studentId);
  return analytics;
};

// 2. GET STUDENT PERFORMANCE SERVICE
export const getStudentPerformanceService = async (studentId, userRole, timeRange = "month") => {
  if (userRole !== "student") {
    throw new Error("UNAUTHORIZED_ROLE");
  }

  const performance = await getPerformanceOverTime(studentId, timeRange);

  return {
    time_range: timeRange,
    performance_data: performance,
  };
};

// 3. GET STUDENT RECOMMENDATIONS SERVICE
export const getStudentRecommendationsService = async (studentId, userRole) => {
  if (userRole !== "student") {
    throw new Error("UNAUTHORIZED_ROLE");
  }

  return {
    weak_areas: [],
    study_plan: { daily_practice: [], weekly_review: [] },
    next_assessments: [],
  };
};

// 4. GET STUDENT ASSESSMENTS SERVICE
// One row per enrolled assessment with a reliable status, so the dashboard
// never offers "Start" for an assessment the student already completed.
export const getStudentAssessmentsService = async (studentId, userRole) => {
  if (userRole !== "student") {
    throw new Error("UNAUTHORIZED_ROLE");
  }

  const rows = await findEnrolledAssessmentsWithStatusQuery(studentId);
  return {
    data: rows.map((r) => {
      const status = !r.attempt_id ? "not_started" : r.attempt_status === "completed" ? "completed" : "in_progress";
      const totalMarks = Number(status === "not_started" ? r.planned_marks : r.attempt_marks) || 0;
      const score = r.score === null || r.score === undefined ? null : Number(r.score);
      return {
        id: r.id,
        title: r.title,
        description: r.prompt ? r.prompt.slice(0, 140) : "",
        status,
        attempt_id: r.attempt_id,
        question_count: Number(r.question_count) || 0,
        duration_seconds: Number(r.duration_seconds) || 0,
        total_marks: totalMarks,
        score: status === "completed" ? score : null,
        percentage:
          status === "completed" && totalMarks > 0 ? Math.round(((score || 0) / totalMarks) * 10000) / 100 : null,
        enrolled_at: r.enrolled_at,
        started_at: r.started_at,
        completed_at: r.completed_at,
      };
    }),
  };
};

// 5. GET ASSESSMENT DETAILS SERVICE
export const getAssessmentDetailsService = async (studentId, assessmentId, userRole) => {
  if (userRole !== "student") {
    throw new Error("UNAUTHORIZED_ROLE");
  }

  const details = await getAssessmentAnalytics(studentId, assessmentId);
  return details;
};

// 6. GET ASSESSMENT QUESTIONS SERVICE
export const getAssessmentQuestionsService = async (studentId, assessmentId, userRole) => {
  if (userRole !== "student") {
    throw new Error("UNAUTHORIZED_ROLE");
  }

  const questions = await modelGetAssessmentQuestions(studentId, assessmentId);
  return questions;
};

// 7. GET STUDENT REPORT SERVICE
export const getStudentReportService = async (studentId, userRole, format = "json", assessmentId = null) => {
  if (userRole !== "student") {
    throw new Error("UNAUTHORIZED_ROLE");
  }


  let report;

  if (assessmentId) {
    // Fetch assessment analytics
    const details = await getAssessmentAnalytics(studentId, parseInt(assessmentId));

    // Generate AI recommendations
    const recommendations = await generateAIRecommendations(details);

    // Build assessment-specific report
    report = {
      student_id: studentId,
      assessment_id: assessmentId,
      assessment_title: details.assessment_title,
      generated_at: new Date().toISOString(),
      score: details.score,
      total_marks: details.total_marks,
      student_score: details.student_score,
      time_taken: details.time_taken,
      total_questions: details.total_questions,
      correct_answers: details.correct_answers,
      incorrect_answers: details.incorrect_answers,
      negative_marks_applied: details.negative_marks_applied || 0,
      student_answers: details.student_answers || [],
      recommendations,
    };
  } else {
    // General report
    const [analytics, performance, recommendations] = await Promise.all([
      getStudentAnalytics(studentId),
      getPerformanceOverTime(studentId, "month"),
      getLearningRecommendations(studentId),
    ]);

    report = {
      student_id: studentId,
      generated_at: new Date().toISOString(),
      overview: analytics,
      performance_trend: performance,
      recommendations,
      summary: {
        total_assessments_completed: analytics.completed_assessments,
        average_performance: analytics.average_score,
        improvement_areas: recommendations.weak_areas.length,
        strengths_count: analytics.strengths.length,
      },
    };
  }

  if (format === "csv") {
    const csvData = convertToCSV(report, !!assessmentId);
    return { format: "csv", data: csvData, assessmentId };
  }

  return { format: "json", data: report };
};


// ==================== HELPER FUNCTIONS ====================

/**
 * Generate AI recommendations for assessment
 */
const generateAIRecommendations = async (details) => {
  const weakQuestionsJson = JSON.stringify(details.weak_questions || []);
  const prompt = `
You are an educational AI assistant.

Generate learning recommendations for the assessment "${details.assessment_title}"
with score ${details.score || 0}%.

Weak questions:
${weakQuestionsJson}

If no weak questions exist, provide general improvement recommendations.

STRICT RULES:
- Respond ONLY with valid JSON
- No markdown
- No explanations
- No extra text

Expected JSON format:
{
  "weak_areas": [
    { "topic": "string", "performance": number, "suggestion": "string" }
  ],
  "study_plan": {
    "daily_practice": [
      { "topic": "string", "focus": "string", "time_allocation": "string" }
    ],
    "weekly_review": [
      { "topic": "string", "activity": "string", "goal": "string" }
    ]
  }
}
`;

  try {
    let responseText = await generateContent(prompt, {
      purpose: "recommendations",
      useCheckingKey: true,
      maxOutputTokens: 1000,
      temperature: 0.4,
      responseMimeType: "application/json",
    });

    responseText = responseText
      .replace(/^```json\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    return JSON.parse(responseText);
  } catch (error) {
    console.error("AI recommendation error:", error);

    // Safe fallback
    return {
      weak_areas:
        details.weak_questions?.map((area) => ({
          topic: area.question_type || "General",
          performance: Math.round((area.performance || 0) * 100),
          suggestion: "Practice more in this area.",
        })) || [],
      study_plan: {
        daily_practice: [
          {
            topic: "General",
            focus: "Review basics",
            time_allocation: "30 minutes",
          },
        ],
        weekly_review: [
          {
            topic: "All",
            activity: "Mock test",
            goal: "Improve by 10%",
          },
        ],
      },
    };
  }
};

/**
 * Convert report data to CSV format
 */
const convertToCSV = (report, isSpecificAssessment = false) => {
  const headers = ["Metric", "Value", "Description"];
  const rows = [];

  if (!isSpecificAssessment) {
    rows.push([
      "Total Assessments",
      report.overview.total_assessments,
      "Number of completed assessments",
    ]);
    rows.push([
      "Average Score",
      `${report.overview.average_score}%`,
      "Average performance across all assessments",
    ]);
    rows.push([
      "Total Time Spent",
      `${Math.round(report.overview.total_time_spent / 60)} minutes`,
      "Total time spent on assessments",
    ]);
    rows.push([
      "Strengths",
      report.overview.strengths.length,
      "Number of identified strengths",
    ]);
    rows.push([
      "Weaknesses",
      report.overview.weaknesses.length,
      "Number of areas needing improvement",
    ]);
  } else {
    rows.push([
      "Score",
      `${report.score}%`,
      "Performance score for this assessment",
    ]);
    rows.push([
      "Total Marks",
      `${report.total_marks}`,
      "Maximum possible score for this assessment",
    ]);
    rows.push([
      "Student Score",
      `${report.student_score}`,
      "Actual score achieved",
    ]);
  }

  rows.push([
    "Improvement Areas",
    report.summary?.improvement_areas || 0,
    "Number of areas with recommendations",
  ]);

  // Add weak areas as additional rows if they exist
  if (report.recommendations?.weak_areas && report.recommendations.weak_areas.length > 0) {
    report.recommendations.weak_areas.forEach((area, index) => {
      rows.push([
        `Weak Area ${index + 1}`,
        area.topic,
        `Performance: ${area.performance}%, Suggestion: ${area.suggestion}`,
      ]);
    });
  }

  return [
    headers.join(","),
    ...rows.map((row) => row.map((field) => `"${field}"`).join(",")),
  ].join("\n");
};