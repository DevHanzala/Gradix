import db from "../DB/db.js";

/**
 * Instructor Assessment Analytics Model
 */

/**
 * Fetch executed assessments for an instructor
 */
export const getInstructorExecutedAssessmentsModel = async (instructorId) => {
  const result = await db.query(
    `SELECT a.id, a.title, a.created_at, COUNT(aa.id) as completed_attempts
     FROM assessments a
     LEFT JOIN assessment_attempts aa ON a.id = aa.assessment_id
     WHERE a.instructor_id = $1
       AND aa.completed_at IS NOT NULL
       AND aa.status = 'completed'
     GROUP BY a.id, a.title, a.created_at
     HAVING COUNT(aa.id) > 0`,
    [instructorId]
  );
  return result.rows;
};

/**
 * Fetch students who completed a specific assessment
 */
export const getAssessmentStudentsModel = async (assessmentId, instructorId) => {
  try {
    // Fetch student data with calculated metrics, including max_score per attempt
    const result = await db.query(
      `SELECT aa.student_id, u.name, aa.started_at, aa.completed_at, 
              aa.score as obtained_score, aa.status,
              (SELECT COUNT(DISTINCT gq.id) 
               FROM generated_questions gq
               WHERE gq.attempt_id = aa.id) as total_questions,
              (SELECT COUNT(*) 
               FROM student_answers sa2 
               WHERE sa2.attempt_id = aa.id AND sa2.is_correct = true) as correct_answers,
              (SELECT COALESCE(SUM(gq.positive_marks), 0) 
               FROM generated_questions gq 
               WHERE gq.attempt_id = aa.id) as max_score,
              (SELECT COALESCE(SUM(CASE WHEN sa2.is_correct = false THEN gq.negative_marks ELSE 0 END), 0)
               FROM student_answers sa2
               JOIN generated_questions gq ON sa2.question_id = gq.id
               WHERE sa2.attempt_id = aa.id) as negative_marks_applied
       FROM assessment_attempts aa
       JOIN assessments a ON a.id = aa.assessment_id
       JOIN users u ON u.id = aa.student_id
       WHERE a.id = $1
         AND a.instructor_id = $2
         AND aa.completed_at IS NOT NULL
         AND aa.status = 'completed'
       GROUP BY aa.id, aa.student_id, u.name, aa.started_at, aa.completed_at, aa.status, aa.score`,
      [assessmentId, instructorId]
    );
    return result.rows.map(row => {
      const timeDiff = row.completed_at ? Math.round((new Date(row.completed_at) - new Date(row.started_at)) / 1000) : 0;
      const minutes = Math.floor(timeDiff / 60);
      const seconds = timeDiff % 60;
      const percentage = row.max_score > 0 ? (row.obtained_score / row.max_score) * 100 : 0;
      return {
        ...row,
        time_taken: timeDiff,
        percentage: Number(percentage.toFixed(2)),
        time_used: `${minutes} min ${seconds} sec`
      };
    });
  } catch (error) {
    console.error("❌ Model error fetching students:", error.message);
    return [];
  }
};

/**
 * Fetch questions and answers for a specific student's attempt
 */
export const getStudentAttemptQuestionsModel = async (assessmentId, studentId, instructorId) => {
  try {
    // Verify instructor owns the assessment
    const assessmentCheck = await db.query(`
      SELECT 1 FROM assessments
      WHERE id = $1 AND instructor_id = $2
    `, [assessmentId, instructorId]);
    if (assessmentCheck.rows.length === 0) {
      throw new Error("Assessment not found or access denied");
    }

    // Get the latest completed attempt for the student
    const attempt = await db.query(`
      SELECT id as attempt_id
      FROM assessment_attempts
      WHERE assessment_id = $1 AND student_id = $2 AND completed_at IS NOT NULL AND status = 'completed'
      ORDER BY completed_at DESC
      LIMIT 1
    `, [assessmentId, studentId]);
    if (attempt.rows.length === 0) {
      throw new Error('No completed attempt found for this student');
    }
    const attemptId = attempt.rows[0].attempt_id;

    // Get questions and answers
    const result = await db.query(`
      SELECT 
        gq.question_order,
        gq.question_text,
        gq.question_type,
        gq.options,
        gq.positive_marks,
        gq.negative_marks,
        gq.correct_answer,
        sa.student_answer,
        sa.score,
        sa.is_correct
      FROM generated_questions gq
      LEFT JOIN student_answers sa ON sa.question_id = gq.id AND sa.attempt_id = $1
      WHERE gq.attempt_id = $1
      ORDER BY gq.question_order
    `, [attemptId]);

    return result.rows;
  } catch (error) {
    console.error("❌ Model error fetching student attempt questions:", error.message);
    throw error;
  }
};