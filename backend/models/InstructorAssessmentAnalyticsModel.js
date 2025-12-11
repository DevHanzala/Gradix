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

        -- SMART CORRECT COUNT (ignores case, quotes, spaces)
        COUNT(CASE WHEN 
          TRIM(LOWER(REPLACE(REPLACE(CAST(gq.correct_answer AS TEXT), '\\"', ''), '"', ''))) = 
          TRIM(LOWER(REPLACE(REPLACE(CAST(sa.student_answer AS TEXT), '\\"', ''), '"', '')))
        THEN 1 END) as correct_answers,

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
        correct_answers: Number(row.correct_answers), // NOW 100% ACCURATE
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

    // FIX: Smart comparison for ALL question types
    return result.rows.map(q => {
      let correct = false;

      const clean = (str) => String(str || "")
        .replace(/\\"/g, '"')           // remove \" 
        .replace(/^["'\s]+|["'\s]+$/g, '') // remove leading/trailing quotes & spaces
        .trim()
        .toLowerCase();

      const c = clean(q.correct_answer);
      const s = clean(q.student_answer);

      correct = c === s;

      return {
        ...q,
        is_correct: correct,
        score: correct ? q.positive_marks : (q.score || -Math.abs(q.negative_marks || 0))
      };
    });

  } catch (error) {
    console.error("Analytics model error:", error);
    throw error;
  }
};