import db from "../DB/db.js";

// ==================== EXECUTED ASSESSMENTS ====================

/**
 * Fetch executed assessments for an instructor with completion count
 */
export const findExecutedAssessmentsByInstructorQuery = async (instructorId) => {
  const query = `
    SELECT a.id, a.title, a.created_at, COUNT(aa.id) as completed_attempts
    FROM assessments a
    LEFT JOIN assessment_attempts aa ON a.id = aa.assessment_id
    WHERE a.instructor_id = $1
      AND aa.completed_at IS NOT NULL
      AND aa.status = 'completed'
    GROUP BY a.id, a.title, a.created_at
    HAVING COUNT(aa.id) > 0
  `;
  
  const result = await db.query(query, [instructorId]);
  return result.rows;
};

// ==================== ASSESSMENT STUDENTS ====================

/**
 * Fetch students who completed a specific assessment (basic info)
 */
export const findAssessmentStudentsBasicQuery = async (assessmentId, instructorId) => {
  const query = `
    SELECT 
      aa.student_id,
      u.name,
      aa.score as obtained_score,
      aa.completed_at,
      aa.started_at,
      COUNT(gq.id) as total_questions,
      COALESCE(SUM(gq.positive_marks), 0) as max_possible_score
    FROM assessment_attempts aa
    JOIN assessments a ON a.id = aa.assessment_id
    JOIN users u ON u.id = aa.student_id
    JOIN generated_questions gq ON gq.attempt_id = aa.id
    LEFT JOIN student_answers sa ON sa.question_id = gq.id AND sa.attempt_id = aa.id
    WHERE a.id = $1 AND a.instructor_id = $2
      AND aa.completed_at IS NOT NULL AND aa.status = 'completed'
    GROUP BY aa.id, aa.student_id, u.name, aa.started_at, aa.completed_at, aa.score
    ORDER BY aa.completed_at DESC
  `;
  
  const result = await db.query(query, [assessmentId, instructorId]);
  return result.rows;
};

/**
 * Fetch correct answer counts for students in an assessment
 */
export const findStudentCorrectAnswersQuery = async (assessmentId) => {
  const query = `
    SELECT 
      aa.student_id,
      COUNT(CASE 
        WHEN gq.question_type = 'short_answer' THEN
          CASE WHEN sa.score > 0 THEN 1 ELSE NULL END
        ELSE
          CASE WHEN TRIM(LOWER(REGEXP_REPLACE(sa.student_answer, '[^a-zA-Z0-9]', '', 'g'))) = 
                   TRIM(LOWER(REGEXP_REPLACE((gq.correct_answer)::text, '[^a-zA-Z0-9]', '', 'g'))) 
          THEN 1 ELSE NULL END
      END) as correct_answers
    FROM assessment_attempts aa
    JOIN generated_questions gq ON gq.attempt_id = aa.id
    LEFT JOIN student_answers sa ON sa.question_id = gq.id AND sa.attempt_id = aa.id
    WHERE aa.assessment_id = $1 AND aa.student_id IN (
      SELECT student_id FROM assessment_attempts WHERE assessment_id = $1 AND status = 'completed'
    )
    GROUP BY aa.student_id
  `;
  
  const result = await db.query(query, [assessmentId]);
  return result.rows;
};

// ==================== STUDENT ATTEMPT QUESTIONS ====================

/**
 * Verify instructor owns the assessment
 */
export const verifyInstructorOwnershipQuery = async (assessmentId, instructorId) => {
  const query = `SELECT 1 FROM assessments WHERE id = $1 AND instructor_id = $2`;
  const result = await db.query(query, [assessmentId, instructorId]);
  return result.rows.length > 0;
};

/**
 * Find latest completed attempt for a student
 */
export const findLatestCompletedAttemptQuery = async (assessmentId, studentId) => {
  const query = `
    SELECT id FROM assessment_attempts 
    WHERE assessment_id = $1 AND student_id = $2 AND status = 'completed' 
    ORDER BY completed_at DESC LIMIT 1
  `;
  
  const result = await db.query(query, [assessmentId, studentId]);
  return result.rows[0] || null;
};

/**
 * Fetch all questions and answers for a specific attempt
 */
export const findAttemptQuestionsWithAnswersQuery = async (attemptId) => {
  const query = `
    SELECT 
      gq.question_order, 
      gq.question_text, 
      gq.question_type, 
      gq.options,
      gq.correct_answer, 
      sa.student_answer, 
      sa.score, 
      gq.positive_marks, 
      gq.negative_marks
    FROM generated_questions gq
    LEFT JOIN student_answers sa ON sa.question_id = gq.id AND sa.attempt_id = $1
    WHERE gq.attempt_id = $1
    ORDER BY gq.question_order
  `;
  
  const result = await db.query(query, [attemptId]);
  return result.rows;
};