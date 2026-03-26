import * as analyticsRepo from "../repositories/studentAnalyticsRepository.js";
import {
  validateStudentAnalyticsQuery,
  validatePerformanceTimeRange,
  validateAssessmentAnalyticsQuery,
} from "../validator/studentAnalytics.validator.js";
import { getCheckingModel } from "../services/ai/aiProviders.js";
import { generateContent } from "../services/ai/generateContent.js";

// ==================== STUDENT OVERVIEW ANALYTICS ====================

export const getStudentAnalytics = async (studentId) => {
  try {
    // VALIDATE INPUT
    const validationErrors = validateStudentAnalyticsQuery({ studentId });
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    const enrolled = await analyticsRepo.findEnrolledAssessmentsQuery(studentId);
    const assessments = await analyticsRepo.findCompletedAssessmentsQuery(studentId);

    const totalEnrolled = enrolled.length;
    const completedCount = assessments.length;

    if (completedCount === 0) {
      return {
        total_assessments: totalEnrolled,
        completed_assessments: 0,
        average_score: 0,
        total_time_spent: 0,
        enrolled_assessments: enrolled,
        progress_trend: [],
        strengths: [],
        weaknesses: [],
        recent_performance: [],
        subject_breakdown: []
      };
    }

    const averageScore = assessments.reduce((sum, a) => sum + (a.percentage || 0), 0) / completedCount;
    const totalTimeSpent = assessments.reduce((sum, a) => sum + (a.time_taken || 0), 0);

    const progressTrend = assessments.slice(-10).map((a, index) => ({
      assessment_id: a.id,
      title: a.title,
      score: a.percentage || 0,
      date: a.submitted_at,
      trend_index: index + 1
    }));

    const recentPerformance = assessments.slice(-5).map(a => ({
      assessment_id: a.id,
      title: a.title,
      score: a.percentage || 0,
      grade: null,
      date: a.submitted_at,
      time_taken: a.time_taken
    }));

    const questionAnalysis = await analyticsRepo.findQuestionAnalysisQuery(studentId);
    const { strengths, weaknesses, subjectBreakdown } = processQuestionAnalysis(questionAnalysis);

    return {
      total_assessments: totalEnrolled,
      completed_assessments: completedCount,
      average_score: Math.round(averageScore),
      total_time_spent: totalTimeSpent,
      enrolled_assessments: enrolled,
      progress_trend: progressTrend,
      strengths,
      weaknesses,
      recent_performance: recentPerformance,
      subject_breakdown: subjectBreakdown
    };
  } catch (error) {
    console.error("❌ getStudentAnalytics error:", error);
    throw error;
  }
};

export const getPerformanceOverTime = async (studentId, timeRange) => {
  try {
    const validationErrors = validateStudentAnalyticsQuery({ studentId });
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    const rangeValidation = validatePerformanceTimeRange(timeRange);
    if (rangeValidation.length > 0) {
      throw new Error(`Validation failed: ${rangeValidation.join(', ')}`);
    }

    let dateFilter = "";
    switch (timeRange) {
      case 'week':
        dateFilter = "AND aa.completed_at >= NOW() - INTERVAL '7 days'";
        break;
      case 'month':
        dateFilter = "AND aa.completed_at >= NOW() - INTERVAL '30 days'";
        break;
      case 'year':
        dateFilter = "AND aa.completed_at >= NOW() - INTERVAL '1 year'";
        break;
      default:
        dateFilter = "";
    }

    const performance = await analyticsRepo.findPerformanceOverTimeQuery(studentId, dateFilter);
    return performance;
  } catch (error) {
    console.error("❌ Error getting performance over time:", error);
    throw error;
  }
};

export const getStudentAssessmentsList = async (studentId) => {
  try {
    const validationErrors = validateStudentAnalyticsQuery({ studentId });
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    const assessments = await analyticsRepo.findCompletedAssessmentsQuery(studentId);
    return assessments;
  } catch (error) {
    console.error("❌ Error getting student assessments list:", error);
    throw error;
  }
};

export const getAssessmentAnalytics = async (studentId, assessmentId) => {
  try {
    const validationErrors = validateAssessmentAnalyticsQuery({ studentId, assessmentId });
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    const attempt = await analyticsRepo.findAttemptDetailsQuery(studentId, assessmentId);
    if (!attempt) {
      throw new Error('No completed attempt found for this assessment');
    }

    const { attempt_id, time_taken, assessment_title, assessment_created_at, student_score, total_marks, percentage } = attempt;

    const questionStats = await analyticsRepo.findQuestionStatsQuery(attempt_id);
    const weakQuestions = await analyticsRepo.findWeakQuestionsQuery(attempt_id);
    const studentAnswers = await analyticsRepo.findStudentAnswerScoresQuery(attempt_id);

    return {
      assessment_title,
      assessment_created_at,
      score: percentage,
      time_taken: Math.floor(time_taken || 0),
      total_questions: questionStats?.total_questions || 0,
      correct_answers: questionStats?.correct_answers || 0,
      incorrect_answers: questionStats?.incorrect_answers || 0,
      negative_marks_applied: questionStats?.negative_marks_applied || 0,
      total_marks,
      student_score,
      student_answers: studentAnswers,
      weak_questions: weakQuestions,
      weak_areas: [],
      recommendations: { weak_areas: [], study_plan: { daily_practice: [], weekly_review: [] } }
    };
  } catch (error) {
    console.error("❌ Error getting assessment analytics:", error);
    throw error;
  }
};

export const getLearningRecommendations = async (studentId) => {
  try {
    const validationErrors = validateStudentAnalyticsQuery({ studentId });
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    const weakAreas = await analyticsRepo.findWeakAreasQuery(studentId);
    let recommendations = {
      weak_areas: [],
      study_plan: { daily_practice: [], weekly_review: [] },
      next_assessments: await analyticsRepo.findRecommendedAssessmentsQuery(studentId)
    };

    if (weakAreas.length === 0) return recommendations;

    try {
      const client = await getCheckingModel();
      const prompt = `You are an educational AI assistant. Generate learning recommendations for a student with the following weak areas: ${JSON.stringify(weakAreas)}. Respond ONLY with a valid JSON object in this exact format: { "weak_areas": [{ "topic": "string", "performance": number, "suggestion": "string" }], "study_plan": { "daily_practice": [{ "topic": "string", "focus": "string", "time_allocation": "string" }], "weekly_review": [{ "topic": "string", "activity": "string", "goal": "string" }] } }. Ensure the JSON is parseable and matches the structure exactly.`;
      
      let responseText = await generateContent(client, prompt, {
        generationConfig: { maxOutputTokens: 1000, temperature: 0.7, response_mime_type: 'application/json' },
        thinkingConfig: { thinkingBudget: 0 },
      });

      responseText = responseText.replace(/^```json\n/, '').replace(/\n```$/, '').trim();
      const aiRecommendations = JSON.parse(responseText);
      
      if (!aiRecommendations.weak_areas || !Array.isArray(aiRecommendations.weak_areas) ||
          !aiRecommendations.study_plan || !aiRecommendations.study_plan.daily_practice ||
          !aiRecommendations.study_plan.weekly_review) {
        throw new Error('Invalid AI response structure');
      }
      
      recommendations = {
        weak_areas: aiRecommendations.weak_areas,
        study_plan: aiRecommendations.study_plan,
        next_assessments: await analyticsRepo.findRecommendedAssessmentsQuery(studentId)
      };
    } catch (parseError) {
      console.error("❌ AI recommendation parsing error:", parseError);
      recommendations = {
        weak_areas: weakAreas.map(area => ({
          topic: area.question_type || 'General',
          performance: Math.round(area.average_performance * 100),
          suggestion: getSuggestionForArea(area.question_type, 'medium')
        })),
        study_plan: generateStudyPlan(weakAreas.map(area => ({
          topic: area.question_type || 'General',
          performance: Math.round(area.average_performance * 100),
          suggestion: getSuggestionForArea(area.question_type, 'medium')
        }))),
        next_assessments: await analyticsRepo.findRecommendedAssessmentsQuery(studentId)
      };
    }

    return recommendations;
  } catch (error) {
    console.error("❌ Error getting learning recommendations:", error);
    throw error;
  }
};

export const getAssessmentQuestions = async (studentId, assessmentId) => {
  try {
    const validationErrors = validateAssessmentAnalyticsQuery({ studentId, assessmentId });
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    const attempt = await analyticsRepo.findStudentAttemptIdQuery(studentId, assessmentId);
    if (!attempt) {
      throw new Error('No completed attempt found for this assessment');
    }

    const attemptId = attempt.attempt_id;
    const questions = await analyticsRepo.findAttemptQuestionsQuery(attemptId);

    return questions.map(q => {
      let expected = "";
      if (q.question_type === 'short_answer' && typeof q.correct_answer === 'object') {
        expected = q.correct_answer.required_keywords?.[0] || "";
      } else {
        expected = String(q.correct_answer).trim().toLowerCase();
      }

      const student = String(q.student_answer || "").trim().toLowerCase();
      const isCorrect = student === expected;
      const score = isCorrect ? q.positive_marks : (q.student_answer ? -q.negative_marks : 0);

      return {
        question_id: q.id,
        question_order: q.question_order,
        question: q.question_text,
        type: q.question_type,
        options: q.options,
        max_marks: q.positive_marks,
        correct_answer: q.correct_answer,
        student_answer: q.student_answer,
        score,
        is_correct: isCorrect,
        negative_marks: q.negative_marks
      };
    });
  } catch (error) {
    console.error("❌ Error getting assessment questions:", error);
    throw error;
  }
};

// ==================== HELPER FUNCTIONS ====================

const processQuestionAnalysis = (questionAnalysis) => {
  const strengths = [];
  const weaknesses = [];
  const subjectBreakdown = {};

  questionAnalysis.forEach(q => {
    const topic = q.question_type || 'General';
    const questionType = q.question_type || 'multiple_choice';

    if (!subjectBreakdown[topic]) {
      subjectBreakdown[topic] = { total_questions: 0, correct_answers: 0, average_score: 0 };
    }
    subjectBreakdown[topic].total_questions++;
    subjectBreakdown[topic].correct_answers += q.scored_marks || 0;

    if (q.performance_category === 'strength') {
      strengths.push({ topic, question_type: questionType, difficulty: 'medium', score: q.scored_marks, max_score: q.positive_marks });
    } else if (q.performance_category === 'weakness') {
      weaknesses.push({ topic, question_type: questionType, difficulty: 'medium', score: q.scored_marks, max_score: q.positive_marks });
    }
  });

  Object.keys(subjectBreakdown).forEach(topic => {
    const breakdown = subjectBreakdown[topic];
    breakdown.average_score = breakdown.total_questions > 0 
      ? Math.round((breakdown.correct_answers / breakdown.total_questions) * 100) : 0;
  });

  return {
    strengths: strengths.sort((a, b) => (b.score / b.max_score) - (a.score / a.max_score)).slice(0, 3),
    weaknesses: weaknesses.sort((a, b) => (a.score / a.max_score) - (b.score / b.max_score)).slice(0, 3),
    subjectBreakdown: Object.entries(subjectBreakdown).map(([topic, data]) => ({ topic, total_questions: data.total_questions, average_score: data.average_score }))
  };
};

const getSuggestionForArea = (questionType, difficulty) => {
  const suggestions = {
    multiple_choice: { easy: "Practice basic concepts and eliminate obvious wrong answers", medium: "Focus on understanding key concepts and common distractors", hard: "Deep dive into complex scenarios and edge cases" },
    true_false: { easy: "Review fundamental facts and definitions", medium: "Practice identifying subtle nuances in statements", hard: "Focus on complex logical reasoning" },
    short_answer: { easy: "Practice concise writing and key term identification", medium: "Work on structured responses and evidence-based answers", hard: "Develop analytical thinking and comprehensive explanations" },
    essay: { easy: "Practice basic essay structure and organization", medium: "Focus on argument development and evidence integration", hard: "Work on critical analysis and synthesis of complex ideas" },
    match_the_column: { easy: "Practice matching basic terms and definitions", medium: "Focus on understanding relationships between concepts", hard: "Work on complex matching with multiple possibilities" },
    general: { easy: "Review basic concepts and practice simple questions", medium: "Focus on core principles and standard problems", hard: "Explore advanced topics and challenging scenarios" }
  };
  return suggestions[questionType?.toLowerCase()]?.[difficulty] || suggestions.general[difficulty] || "Practice more questions in this area";
};

const generateStudyPlan = (weakAreas) => ({
  daily_practice: weakAreas.slice(0, 2).map(area => ({ topic: area.topic, focus: area.suggestion, time_allocation: "30 minutes" })),
  weekly_review: weakAreas.slice(0, 3).map(area => ({ topic: area.topic, activity: "Practice test", goal: `Improve ${area.topic} performance by 20%` })),
  monthly_assessment: "Take a comprehensive assessment to measure progress"
});