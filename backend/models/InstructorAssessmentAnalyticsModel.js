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
    const result = await db.query(`
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
    `, [assessmentId, instructorId]);

    // Smart correct count using saved score for short answer, string compare for others
    const detailedResult = await db.query(`
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
    `, [assessmentId]);

    const correctMap = {};
    detailedResult.rows.forEach(row => {
      correctMap[row.student_id] = Number(row.correct_answers || 0);
    });

    return result.rows.map(row => {
      const timeDiff = row.started_at && row.completed_at 
        ? Math.round((new Date(row.completed_at) - new Date(row.started_at)) / 1000) 
        : 0;
      const minutes = Math.floor(timeDiff / 60);
      const seconds = timeDiff % 60;

      const percentage = row.max_possible_score > 0 
        ? Math.round((row.obtained_score / row.max_possible_score) * 100)
        : 0;

      return {
        student_id: row.student_id,
        name: row.name,
        total_questions: Number(row.total_questions),
        correct_answers: correctMap[row.student_id] || 0,
        percentage,
        time_used: `${minutes}m ${seconds}s`,
        time_taken: timeDiff
      };
    });
  } catch (error) {
    console.error("Error fetching students:", error);
    return [];
  }
};


  /**
   * Fetch questions and answers for a specific student's attempt
   */
  export const getStudentAttemptQuestionsModel = async (assessmentId, studentId, instructorId) => {
  try {
    // Verify instructor owns the assessment
    const check = await db.query(`SELECT 1 FROM assessments WHERE id = $1 AND instructor_id = $2`, [assessmentId, instructorId]);
    if (check.rows.length === 0) throw new Error("Access denied");

    // Get latest attempt
    const attempt = await db.query(`
      SELECT id FROM assessment_attempts 
      WHERE assessment_id = $1 AND student_id = $2 AND status = 'completed' 
      ORDER BY completed_at DESC LIMIT 1
    `, [assessmentId, studentId]);

    if (attempt.rows.length === 0) return [];

    const attemptId = attempt.rows[0].id;

    // Get all questions
    const result = await db.query(`
      SELECT 
        gq.question_order, gq.question_text, gq.question_type, gq.options,
        gq.correct_answer, sa.student_answer, sa.score, gq.positive_marks, gq.negative_marks
      FROM generated_questions gq
      LEFT JOIN student_answers sa ON sa.question_id = gq.id AND sa.attempt_id = $1
      WHERE gq.attempt_id = $1
      ORDER BY gq.question_order
    `, [attemptId]);

    const clean = (str) => {
      if (str === null || str === undefined) return "";
      return String(str)
        .replace(/\\"/g, '"')
        .replace(/^["'\s]+|["'\s]+$/g, '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    };

    return result.rows.map(q => {
      const studentClean = clean(q.student_answer);
      const correctClean = clean(q.correct_answer);

      const isCorrect = studentClean === correctClean;

      return {
        ...q,
        is_correct: isCorrect,
        score: isCorrect ? q.positive_marks : (q.score || -Math.abs(q.negative_marks || 0))
      };
    });

  } catch (error) {
    console.error("Analytics model error:", error);
    throw error;
  }
};
