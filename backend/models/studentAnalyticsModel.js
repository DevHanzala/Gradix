import db from "../DB/db.js";
import { getCreationModel, generateContent } from "../services/geminiService.js";

/**
 * Student Analytics Model
 * Handles student progress tracking, performance analysis, and strengths/weaknesses
 */

/**
 * Get student's overall performance analytics
 * @param {number} studentId - Student ID
 * @returns {Object} Student analytics data
 */
export const getStudentAnalytics = async (studentId) => {
  try {
    console.log(`📊 Getting analytics for student ${studentId}`);

    const enrolledAssessments = await db.query(`
      SELECT 
        a.id,
        a.title,
        a.prompt,
        e.enrolled_at
      FROM enrollments e
      JOIN assessments a ON e.assessment_id = a.id
      WHERE e.student_id = $1
      ORDER BY e.enrolled_at DESC
    `, [studentId]);

    const completedAssessments = await db.query(`
      SELECT 
        a.id,
        a.title,
        aa.completed_at AS submitted_at,
        aa.score AS obtained_score,
        (SELECT COALESCE(SUM(gq.positive_marks), 0)
         FROM generated_questions gq
         JOIN assessment_attempts aa2 ON gq.attempt_id = aa2.id
         WHERE aa2.assessment_id = a.id AND aa2.id = aa.id) AS total_marks,
        CASE WHEN (SELECT COALESCE(SUM(gq.positive_marks), 0)
          FROM generated_questions gq
          JOIN assessment_attempts aa2 ON gq.attempt_id = aa2.id
          WHERE aa2.assessment_id = a.id AND aa2.id = aa.id) > 0
          THEN ROUND((aa.score / (SELECT COALESCE(SUM(gq.positive_marks), 0)
            FROM generated_questions gq
            JOIN assessment_attempts aa2 ON gq.attempt_id = aa2.id
            WHERE aa2.assessment_id = a.id AND aa2.id = aa.id) * 100)::numeric, 2)
          ELSE 0 END AS percentage,
        EXTRACT(EPOCH FROM (aa.completed_at - aa.started_at)) AS time_taken
      FROM assessment_attempts aa
      JOIN assessments a ON aa.assessment_id = a.id
      WHERE aa.student_id = $1 
        AND aa.completed_at IS NOT NULL
        AND aa.status = 'completed'
      GROUP BY a.id, a.title, aa.completed_at, aa.started_at, aa.id, aa.score
      ORDER BY aa.completed_at ASC
    `, [studentId]);

    const assessments = completedAssessments.rows;
    const enrolled = enrolledAssessments.rows;

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

    const questionAnalysis = await db.query(`
      SELECT 
        gq.question_type,
        sa.score AS scored_marks,
        gq.positive_marks,
        CASE 
          WHEN sa.score >= gq.positive_marks * 0.8 THEN 'strength'
          WHEN sa.score <= gq.positive_marks * 0.6 THEN 'weakness'
          ELSE 'average'
        END as performance_category
      FROM student_answers sa
      JOIN generated_questions gq ON sa.question_id = gq.id
      JOIN assessment_attempts aa ON sa.attempt_id = aa.id
      WHERE aa.student_id = $1 
        AND aa.completed_at IS NOT NULL
        AND sa.score IS NOT NULL
    `, [studentId]);

    const strengths = [];
    const weaknesses = [];
    const subjectBreakdown = {};

    questionAnalysis.rows.forEach(q => {
      const topic = q.question_type || 'General';
      const questionType = q.question_type || 'multiple_choice';

      if (!subjectBreakdown[topic]) {
        subjectBreakdown[topic] = {
          total_questions: 0,
          correct_answers: 0,
          average_score: 0
        };
      }
      subjectBreakdown[topic].total_questions++;
      subjectBreakdown[topic].correct_answers += q.scored_marks || 0;

      if (q.performance_category === 'strength') {
        strengths.push({
          topic,
          question_type: questionType,
          difficulty: 'medium',
          score: q.scored_marks,
          max_score: q.positive_marks
        });
      } else if (q.performance_category === 'weakness') {
        weaknesses.push({
          topic,
          question_type: questionType,
          difficulty: 'medium',
          score: q.scored_marks,
          max_score: q.positive_marks
        });
      }
    });

    Object.keys(subjectBreakdown).forEach(topic => {
      const breakdown = subjectBreakdown[topic];
      breakdown.average_score = breakdown.total_questions > 0 
        ? Math.round((breakdown.correct_answers / breakdown.total_questions) * 100) 
        : 0;
    });

    const topStrengths = strengths
      .sort((a, b) => (b.score / b.max_score) - (a.score / a.max_score))
      .slice(0, 3);

    const topWeaknesses = weaknesses
      .sort((a, b) => (a.score / a.max_score) - (b.score / b.max_score))
      .slice(0, 3);

    return {
      total_assessments: totalEnrolled,
      completed_assessments: completedCount,
      average_score: Math.round(averageScore),
      total_time_spent: totalTimeSpent,
      enrolled_assessments: enrolled,
      progress_trend: progressTrend,
      strengths: topStrengths,
      weaknesses: topWeaknesses,
      recent_performance: recentPerformance,
      subject_breakdown: Object.entries(subjectBreakdown).map(([topic, data]) => ({
        topic,
        total_questions: data.total_questions,
        average_score: data.average_score
      }))
    };
  } catch (error) {
    console.error("❌ getStudentAnalytics error:", error);
    throw error;
  }
};

/**
 * Get student's performance over time
 * @param {number} studentId - Student ID
 * @param {string} timeRange - 'week', 'month', or 'year'
 * @returns {Array} Performance data points
 */
export const getPerformanceOverTime = async (studentId, timeRange) => {
  try {
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

    const query = `
      SELECT 
        date,
        AVG(percentage) as average_score,
        assessments_taken,
        total_time
      FROM (
        SELECT 
          DATE(aa.completed_at) as date,
          (aa.score / (SELECT COALESCE(SUM(gq.positive_marks), 0)
            FROM generated_questions gq
            JOIN assessment_attempts aa2 ON gq.attempt_id = aa2.id
            WHERE aa2.assessment_id = aa.assessment_id AND aa2.id = aa.id) * 100) as percentage,
          COUNT(DISTINCT aa.id) as assessments_taken,
          SUM(EXTRACT(EPOCH FROM (aa.completed_at - aa.started_at))) as total_time
        FROM assessment_attempts aa
        JOIN assessments a ON aa.assessment_id = a.id
        WHERE aa.student_id = $1 
          AND aa.completed_at IS NOT NULL
          AND aa.status = 'completed'
          ${dateFilter}
        GROUP BY aa.id, DATE(aa.completed_at), aa.assessment_id, aa.score
      ) as sub
      GROUP BY date, assessments_taken, total_time
      ORDER BY date ASC
    `;

    const result = await db.query(query, [studentId]);
    return result.rows;
  } catch (error) {
    console.error("❌ Error getting performance over time:", error);
    throw error;
  }
};

/**
 * Get student's completed assessments list
 * @param {number} studentId - Student ID
 * @returns {Array} List of assessments
 */
export const getStudentAssessmentsList = async (studentId) => {
  try {
    const query = `
      SELECT 
        a.id,
        a.title,
        aa.score AS obtained_score,
        (SELECT COALESCE(SUM(gq.positive_marks), 0)
         FROM generated_questions gq
         JOIN assessment_attempts aa2 ON gq.attempt_id = aa2.id
         WHERE aa2.assessment_id = a.id AND aa2.id = aa.id) AS total_marks,
        CASE WHEN (SELECT COALESCE(SUM(gq.positive_marks), 0)
          FROM generated_questions gq
          JOIN assessment_attempts aa2 ON gq.attempt_id = aa2.id
          WHERE aa2.assessment_id = a.id AND aa2.id = aa.id) > 0
          THEN ROUND((aa.score / (SELECT COALESCE(SUM(gq.positive_marks), 0)
            FROM generated_questions gq
            JOIN assessment_attempts aa2 ON gq.attempt_id = aa2.id
            WHERE aa2.assessment_id = a.id AND aa2.id = aa.id) * 100)::numeric, 2)
          ELSE 0 END AS percentage,
        aa.completed_at AS date
      FROM assessment_attempts aa
      JOIN assessments a ON aa.assessment_id = a.id
      WHERE aa.student_id = $1 
        AND aa.completed_at IS NOT NULL
        AND aa.status = 'completed'
      GROUP BY a.id, a.title, aa.completed_at, aa.id, aa.score
      ORDER BY aa.completed_at DESC
    `;
    const result = await db.query(query, [studentId]);
    return result.rows;
  } catch (error) {
    console.error("❌ Error getting student assessments list:", error);
    throw error;
  }
};

/**
 * Get analytics for a specific assessment
 * @param {number} studentId - Student ID
 * @param {number} assessmentId - Assessment ID
 * @returns {Object} Assessment analytics
 */
/**
 */
/**
 * Get analytics for a specific assessment — NO AI RECOMMENDATIONS HERE
 */
// UPDATE IN studentAnalyticsModel.js — COMPLETE FUNCTION (NO AI HERE)
export const getAssessmentAnalytics = async (studentId, assessmentId) => {
  try {
    const attempt = await db.query(`
      SELECT 
        aa.id as attempt_id,
        EXTRACT(EPOCH FROM (aa.completed_at - aa.started_at)) as time_taken,
        a.title as assessment_title,
        a.created_at as assessment_created_at,
        aa.score as student_score,
        (SELECT COALESCE(SUM(gq.positive_marks), 0)
         FROM generated_questions gq
         WHERE gq.attempt_id = aa.id) AS total_marks,
        CASE WHEN (SELECT COALESCE(SUM(gq.positive_marks), 0)
          FROM generated_questions gq
          WHERE gq.attempt_id = aa.id) > 0
          THEN ROUND((aa.score / (SELECT COALESCE(SUM(gq.positive_marks), 0)
            FROM generated_questions gq
            WHERE gq.attempt_id = aa.id) * 100)::numeric, 2)
          ELSE 0 END AS percentage
      FROM assessment_attempts aa
      JOIN assessments a ON aa.assessment_id = a.id
      WHERE aa.student_id = $1 
        AND aa.assessment_id = $2
        AND aa.completed_at IS NOT NULL
        AND aa.status = 'completed'
      GROUP BY aa.id, a.title, a.created_at, aa.completed_at, aa.started_at, aa.score
      ORDER BY aa.completed_at DESC
      LIMIT 1
    `, [studentId, assessmentId]);

    if (attempt.rows.length === 0) {
      throw new Error('No completed attempt found for this assessment');
    }

    const { attempt_id, time_taken, assessment_title, assessment_created_at, student_score, total_marks, percentage } = attempt.rows[0];

const questionStats = await db.query(`
  SELECT 
    COUNT(DISTINCT gq.id) as total_questions,
    SUM(CASE 
      WHEN sa.student_answer IS NULL THEN 0
      WHEN TRIM(LOWER(REGEXP_REPLACE(sa.student_answer, '[^a-zA-Z0-9]', '', 'g'))) = TRIM(LOWER(REGEXP_REPLACE(gq.correct_answer, '[^a-zA-Z0-9]', '', 'g'))) THEN 1 
      ELSE 0 
    END) as correct_answers,
    SUM(CASE 
      WHEN sa.student_answer IS NULL THEN 0
      WHEN TRIM(LOWER(REGEXP_REPLACE(sa.student_answer, '[^a-zA-Z0-9]', '', 'g'))) != TRIM(LOWER(REGEXP_REPLACE(gq.correct_answer, '[^a-zA-Z0-9]', '', 'g'))) THEN 1 
      ELSE 0 
    END) as incorrect_answers,
    SUM(CASE 
      WHEN sa.student_answer IS NULL THEN 0
      WHEN TRIM(LOWER(REGEXP_REPLACE(sa.student_answer, '[^a-zA-Z0-9]', '', 'g'))) != TRIM(LOWER(REGEXP_REPLACE(gq.correct_answer, '[^a-zA-Z0-9]', '', 'g'))) THEN COALESCE(gq.negative_marks, 0) 
      ELSE 0 
    END) as negative_marks_applied
  FROM generated_questions gq
  LEFT JOIN student_answers sa ON sa.question_id = gq.id AND sa.attempt_id = $1
  WHERE gq.attempt_id = $1
`, [attempt_id]);

console.log("Question Stats Result:", questionStats.rows[0]);
console.log("negative_marks_applied calculated:", questionStats.rows[0].negative_marks_applied);

    // Fetch weak questions for report generation later
    const weak_questions = await db.query(`
      SELECT 
        gq.question_type,
        gq.question_text,
        (sa.score::NUMERIC / NULLIF(gq.positive_marks, 0)) as performance,
        sa.score as scored_marks,
        gq.positive_marks
      FROM student_answers sa
      JOIN generated_questions gq ON sa.question_id = gq.id
      WHERE sa.attempt_id = $1
        AND (sa.score::NUMERIC / NULLIF(gq.positive_marks, 0)) <= 0.6
      ORDER BY performance ASC
    `, [attempt_id]);

    const studentAnswers = await db.query(`
  SELECT score
  FROM student_answers
  WHERE attempt_id = $1
`, [attempt_id]);

    return {
      assessment_title,
      assessment_created_at,
      score: percentage,
      time_taken: Math.floor(time_taken || 0),
      total_questions: questionStats.rows[0].total_questions || 0,
      correct_answers: questionStats.rows[0].correct_answers || 0,
      incorrect_answers: questionStats.rows[0].incorrect_answers || 0,
      negative_marks_applied: questionStats.rows[0].negative_marks_applied || 0,
      total_marks: total_marks,
      student_score: student_score,
      student_answers: studentAnswers.rows, // ADD THIS LINE
      weak_questions: weak_questions.rows, // add this for report AI input
      weak_areas: [], // empty
      recommendations: { // empty
        weak_areas: [],
        study_plan: { daily_practice: [], weekly_review: [] }
      }
    };
  } catch (error) {
    console.error("❌ Error getting assessment analytics:", error);
    throw error;
  }
};

/**
 * Get student's learning recommendations (aggregate)
 * @param {number} studentId - Student ID
 * @returns {Object} Learning recommendations
 */
export const getLearningRecommendations = async (studentId) => {
  try {
    const weakAreas = await db.query(`
      SELECT 
        gq.question_type,
        COUNT(*) as question_count,
        AVG(sa.score * 1.0 / gq.positive_marks) as average_performance
      FROM student_answers sa
      JOIN generated_questions gq ON sa.question_id = gq.id
      JOIN assessment_attempts aa ON sa.attempt_id = aa.id
      WHERE aa.student_id = $1 
        AND aa.completed_at IS NOT NULL
        AND sa.score IS NOT NULL
        AND sa.score <= gq.positive_marks * 0.6
      GROUP BY gq.question_type
      ORDER BY average_performance ASC
      LIMIT 5
    `, [studentId]);

    let recommendations = {
      weak_areas: [],
      study_plan: { daily_practice: [], weekly_review: [] },
      next_assessments: await getRecommendedAssessments(studentId)
    };

    if (weakAreas.rows.length === 0) {
      return recommendations;
    }

    const client = await getCreationModel();
    const prompt = `You are an educational AI assistant. Generate learning recommendations for a student with the following weak areas: ${JSON.stringify(weakAreas.rows)}. Respond ONLY with a valid JSON object in this exact format: { "weak_areas": [{ "topic": "string", "performance": number, "suggestion": "string" }], "study_plan": { "daily_practice": [{ "topic": "string", "focus": "string", "time_allocation": "string" }], "weekly_review": [{ "topic": "string", "activity": "string", "goal": "string" }] } }. Ensure the JSON is parseable and matches the structure exactly.`;
    let responseText = await generateContent(client, prompt, {
      generationConfig: { maxOutputTokens: 1000, temperature: 0.5, response_mime_type: 'application/json' },
      thinkingConfig: { thinkingBudget: 0 },
    });

    responseText = responseText.replace(/^```json\n/, '').replace(/\n```$/, '').trim();

    try {
      const aiRecommendations = JSON.parse(responseText);
      if (!aiRecommendations.weak_areas || !Array.isArray(aiRecommendations.weak_areas) ||
          !aiRecommendations.study_plan || !aiRecommendations.study_plan.daily_practice ||
          !aiRecommendations.study_plan.weekly_review) {
        throw new Error('Invalid AI response structure');
      }
      recommendations = {
        weak_areas: aiRecommendations.weak_areas,
        study_plan: aiRecommendations.study_plan,
        next_assessments: await getRecommendedAssessments(studentId)
      };
    } catch (parseError) {
      console.error("❌ AI recommendation parsing error:", parseError);
      console.log("Debug: Raw response text:", responseText);
      console.log("Falling back to default recommendations");
      recommendations = {
        weak_areas: weakAreas.rows.map(area => ({
          topic: area.question_type || 'General',
          performance: Math.round(area.average_performance * 100),
          suggestion: getSuggestionForArea(area.question_type, 'medium')
        })),
        study_plan: generateStudyPlan(weakAreas.rows.map(area => ({
          topic: area.question_type || 'General',
          performance: Math.round(area.average_performance * 100),
          suggestion: getSuggestionForArea(area.question_type, 'medium')
        }))),
        next_assessments: await getRecommendedAssessments(studentId)
      };
    }

    return recommendations;
  } catch (error) {
    console.error("❌ Error getting learning recommendations:", error);
    throw error;
  }
};

/**
 * Get suggestion for weak area (fallback if AI fails)
 */
const getSuggestionForArea = (questionType, difficulty) => {
  const suggestions = {
    multiple_choice: {
      easy: "Practice basic concepts and eliminate obvious wrong answers",
      medium: "Focus on understanding key concepts and common distractors",
      hard: "Deep dive into complex scenarios and edge cases"
    },
    true_false: {
      easy: "Review fundamental facts and definitions",
      medium: "Practice identifying subtle nuances in statements",
      hard: "Focus on complex logical reasoning"
    },
    short_answer: {
      easy: "Practice concise writing and key term identification",
      medium: "Work on structured responses and evidence-based answers",
      hard: "Develop analytical thinking and comprehensive explanations"
    },
    essay: {
      easy: "Practice basic essay structure and organization",
      medium: "Focus on argument development and evidence integration",
      hard: "Work on critical analysis and synthesis of complex ideas"
    },
    match_the_column: {
      easy: "Practice matching basic terms and definitions",
      medium: "Focus on understanding relationships between concepts",
      hard: "Work on complex matching with multiple possibilities"
    },
    general: {
      easy: "Review basic concepts and practice simple questions",
      medium: "Focus on core principles and standard problems",
      hard: "Explore advanced topics and challenging scenarios"
    }
  };

  return suggestions[questionType?.toLowerCase()]?.[difficulty] || suggestions.general[difficulty] || "Practice more questions in this area";
};

/**
 * Generate study plan based on weak areas (fallback if AI fails)
 */
const generateStudyPlan = (weakAreas) => {
  const plan = {
    daily_practice: weakAreas.slice(0, 2).map(area => ({
      topic: area.topic,
      focus: area.suggestion,
      time_allocation: "30 minutes"
    })),
    weekly_review: weakAreas.slice(0, 3).map(area => ({
      topic: area.topic,
      activity: "Practice test",
      goal: `Improve ${area.topic} performance by 20%`
    })),
    monthly_assessment: "Take a comprehensive assessment to measure progress"
  };

  return plan;
};

/**
 * Get recommended assessments for student
 */
const getRecommendedAssessments = async (studentId) => {
  try {
    const query = `
      SELECT 
        a.id,
        a.title,
        a.prompt as description,
        NULL as duration,
        NULL as total_marks
      FROM enrollments e
      JOIN assessments a ON e.assessment_id = a.id
      WHERE e.student_id = $1 
        AND a.id NOT IN (
          SELECT DISTINCT assessment_id 
          FROM assessment_attempts 
          WHERE student_id = $1 AND completed_at IS NOT NULL
        )
      ORDER BY a.created_at DESC
      LIMIT 3
    `;

    const result = await db.query(query, [studentId]);
    return result.rows;
  } catch (error) {
    console.error("❌ Error getting recommended assessments:", error);
    return [];
  }
};

/**
 * Get questions and answers for a specific assessment attempt
 * @param {number} studentId - Student ID
 * @param {number} assessmentId - Assessment ID
 * @returns {Array} List of questions with answers and scores
 */
export const getAssessmentQuestions = async (studentId, assessmentId) => {
  try {
    // First get the latest completed attempt
    const attemptQuery = `
      SELECT id as attempt_id
      FROM assessment_attempts
      WHERE student_id = $1 AND assessment_id = $2 AND completed_at IS NOT NULL AND status = 'completed'
      ORDER BY completed_at DESC
      LIMIT 1
    `;
    const attemptRes = await db.query(attemptQuery, [studentId, assessmentId]);
    if (attemptRes.rows.length === 0) {
      throw new Error('No completed attempt found for this assessment');
    }
    const attemptId = attemptRes.rows[0].attempt_id;

    // Now get questions
    const questionsQuery = `
      SELECT 
        gq.id,
        gq.question_order,
        gq.question_text,
        gq.question_type,
        gq.options,
        gq.positive_marks,
        gq.correct_answer,
        sa.student_answer,
        sa.score,
        sa.is_correct,
        gq.negative_marks
      FROM generated_questions gq
      LEFT JOIN student_answers sa ON sa.question_id = gq.id AND sa.attempt_id = $1
      WHERE gq.attempt_id = $1
      ORDER BY gq.question_order
    `;
    const questionsRes = await db.query(questionsQuery, [attemptId]);

    return questionsRes.rows.map(q => {
      // Normalize and compare answers
      const normalizedStudentAnswer = (q.student_answer || '').trim().replace(/"/g, '').toLowerCase();
      const normalizedCorrectAnswer = (q.correct_answer || '').trim().replace(/"/g, '').toLowerCase();
      const computedIsCorrect = normalizedStudentAnswer === normalizedCorrectAnswer;
      const computedScore = computedIsCorrect ? q.positive_marks : (q.negative_marks || 0);

      return {
        question_id: q.id,
        question_order: q.question_order,
        question: q.question_text,
        type: q.question_type,
        options: q.options,
        max_marks: q.positive_marks,
        correct_answer: q.correct_answer,
        student_answer: q.student_answer,
        score: computedScore,
        is_correct: computedIsCorrect,
        negative_marks: q.negative_marks
      };
    });
  } catch (error) {
    console.error("❌ Error getting assessment questions:", error);
    throw error;
  }
};