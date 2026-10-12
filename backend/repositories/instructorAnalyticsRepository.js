import db from "../DB/db.js";

// See studentAnalyticsRepository.js for these conventions.
const ONLINE = "aa.is_physical_paper = FALSE AND aa.superseded = FALSE";
const IS_CORRECT = "COALESCE(sa.is_correct, sa.score > 0)";

// ==================== EXECUTED ASSESSMENTS ====================

/** The instructor's assessments that have at least one completed online attempt. */
export const findExecutedAssessmentsByInstructorQuery = async (instructorId) => {
  const { rows } = await db.query(
    `SELECT a.id, a.title, a.created_at, COUNT(aa.id) AS completed_attempts
     FROM assessments a
     JOIN assessment_attempts aa ON a.id = aa.assessment_id
     WHERE a.instructor_id = $1 AND aa.status = 'completed' AND aa.completed_at IS NOT NULL AND ${ONLINE}
     GROUP BY a.id, a.title, a.created_at
     ORDER BY a.created_at DESC`,
    [instructorId]
  );
  return rows;
};

// ==================== ASSESSMENT STUDENTS ====================

/** One row per completed online attempt, with question counts and correctness. */
export const findAssessmentStudentsBasicQuery = async (assessmentId, instructorId) => {
  const { rows } = await db.query(
    `SELECT
       aa.student_id,
       u.name,
       aa.score AS obtained_score,
       aa.completed_at,
       aa.started_at,
       COUNT(gq.id)::int AS total_questions,
       COALESCE(SUM(gq.positive_marks), 0) AS max_possible_score,
       COUNT(*) FILTER (WHERE sa.student_answer IS NOT NULL AND ${IS_CORRECT})::int AS correct_answers
     FROM assessment_attempts aa
     JOIN assessments a ON a.id = aa.assessment_id
     JOIN users u ON u.id = aa.student_id
     JOIN generated_questions gq ON gq.attempt_id = aa.id
     LEFT JOIN student_answers sa ON sa.question_id = gq.id AND sa.attempt_id = aa.id
     WHERE a.id = $1 AND a.instructor_id = $2
       AND aa.status = 'completed' AND aa.completed_at IS NOT NULL AND ${ONLINE}
     GROUP BY aa.id, aa.student_id, u.name, aa.started_at, aa.completed_at, aa.score
     ORDER BY aa.completed_at DESC`,
    [assessmentId, instructorId]
  );
  return rows;
};

// ==================== STUDENT ATTEMPT QUESTIONS ====================

export const verifyInstructorOwnershipQuery = async (assessmentId, instructorId) => {
  const { rows } = await db.query(`SELECT 1 FROM assessments WHERE id = $1 AND instructor_id = $2`, [
    assessmentId,
    instructorId,
  ]);
  return rows.length > 0;
};

export const findLatestCompletedAttemptQuery = async (assessmentId, studentId) => {
  const { rows } = await db.query(
    `SELECT aa.id FROM assessment_attempts aa
     WHERE aa.assessment_id = $1 AND aa.student_id = $2 AND aa.status = 'completed' AND ${ONLINE}
     ORDER BY aa.completed_at DESC
     LIMIT 1`,
    [assessmentId, studentId]
  );
  return rows[0] || null;
};

export const findAttemptQuestionsWithAnswersQuery = async (attemptId) => {
  const { rows } = await db.query(
    `SELECT
       gq.question_order, gq.question_text, gq.question_type, gq.options,
       gq.correct_answer, sa.student_answer, sa.score, sa.is_correct,
       gq.positive_marks, gq.negative_marks
     FROM generated_questions gq
     LEFT JOIN student_answers sa ON sa.question_id = gq.id AND sa.attempt_id = $1
     WHERE gq.attempt_id = $1
     ORDER BY gq.question_order`,
    [attemptId]
  );
  return rows;
};
