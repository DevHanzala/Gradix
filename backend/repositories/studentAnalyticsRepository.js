import db from "../DB/db.js";

// ==================== STUDENT OVERVIEW ANALYTICS ====================

export const findEnrolledAssessmentsQuery = async (studentId) => {
  const query = `
    SELECT 
      a.id,
      a.title,
      a.prompt,
      e.enrolled_at
    FROM enrollments e
    JOIN assessments a ON e.assessment_id = a.id
    WHERE e.student_id = $1
    ORDER BY e.enrolled_at DESC
  `;
  
  const result = await db.query(query, [studentId]);
  return result.rows;
};

export const findCompletedAssessmentsQuery = async (studentId) => {
  const query = `
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
  `;
  
  const result = await db.query(query, [studentId]);
  return result.rows;
};

export const findQuestionAnalysisQuery = async (studentId) => {
  const query = `
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
  `;
  
  const result = await db.query(query, [studentId]);
  return result.rows;
};

// ==================== PERFORMANCE OVER TIME ====================

export const findPerformanceOverTimeQuery = async (studentId, dateFilter) => {
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
};

// ==================== ASSESSMENT ANALYTICS ====================

export const findAttemptDetailsQuery = async (studentId, assessmentId) => {
  const query = `
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
  `;
  
  const result = await db.query(query, [studentId, assessmentId]);
  return result.rows[0] || null;
};

export const findQuestionStatsQuery = async (attemptId) => {
  const query = `
    SELECT 
      COUNT(DISTINCT gq.id) as total_questions,
      SUM(CASE 
        WHEN sa.student_answer IS NULL THEN 0
        WHEN gq.question_type = 'short_answer' THEN
          CASE WHEN sa.score > 0 THEN 1 ELSE 0 END
        ELSE
          CASE WHEN TRIM(LOWER(REGEXP_REPLACE(sa.student_answer, '[^a-zA-Z0-9]', '', 'g'))) = 
                   TRIM(LOWER(REGEXP_REPLACE((gq.correct_answer)::text, '[^a-zA-Z0-9]', '', 'g'))) 
          THEN 1 ELSE 0 END
      END) as correct_answers,
      SUM(CASE 
        WHEN sa.student_answer IS NULL THEN 0
        WHEN gq.question_type = 'short_answer' THEN
          CASE WHEN sa.score <= 0 AND sa.student_answer IS NOT NULL THEN 1 ELSE 0 END
        ELSE
          CASE WHEN TRIM(LOWER(REGEXP_REPLACE(sa.student_answer, '[^a-zA-Z0-9]', '', 'g'))) != 
                   TRIM(LOWER(REGEXP_REPLACE((gq.correct_answer)::text, '[^a-zA-Z0-9]', '', 'g'))) 
          THEN 1 ELSE 0 END
      END) as incorrect_answers,
      SUM(CASE 
        WHEN sa.student_answer IS NULL THEN 0
        WHEN gq.question_type = 'short_answer' THEN
          CASE WHEN sa.score < 0 THEN ABS(sa.score) ELSE 0 END
        ELSE
          CASE WHEN TRIM(LOWER(REGEXP_REPLACE(sa.student_answer, '[^a-zA-Z0-9]', '', 'g'))) != 
                   TRIM(LOWER(REGEXP_REPLACE((gq.correct_answer)::text, '[^a-zA-Z0-9]', '', 'g'))) 
          THEN COALESCE(gq.negative_marks, 0) ELSE 0 END
      END) as negative_marks_applied
    FROM generated_questions gq
    LEFT JOIN student_answers sa ON sa.question_id = gq.id AND sa.attempt_id = $1
    WHERE gq.attempt_id = $1
  `;
  
  const result = await db.query(query, [attemptId]);
  return result.rows[0] || null;
};

export const findWeakQuestionsQuery = async (attemptId) => {
  const query = `
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
  `;
  
  const result = await db.query(query, [attemptId]);
  return result.rows;
};

export const findStudentAnswerScoresQuery = async (attemptId) => {
  const query = `SELECT score FROM student_answers WHERE attempt_id = $1`;
  const result = await db.query(query, [attemptId]);
  return result.rows;
};

// ==================== LEARNING RECOMMENDATIONS ====================

export const findWeakAreasQuery = async (studentId) => {
  const query = `
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
  `;
  
  const result = await db.query(query, [studentId]);
  return result.rows;
};

export const findRecommendedAssessmentsQuery = async (studentId) => {
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
};

// ==================== ASSESSMENT QUESTIONS ====================

export const findStudentAttemptIdQuery = async (studentId, assessmentId) => {
  const query = `
    SELECT id as attempt_id
    FROM assessment_attempts
    WHERE student_id = $1 AND assessment_id = $2 AND completed_at IS NOT NULL AND status = 'completed'
    ORDER BY completed_at DESC
    LIMIT 1
  `;
  
  const result = await db.query(query, [studentId, assessmentId]);
  return result.rows[0] || null;
};

export const findAttemptQuestionsQuery = async (attemptId) => {
  const query = `
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
  
  const result = await db.query(query, [attemptId]);
  return result.rows;
};