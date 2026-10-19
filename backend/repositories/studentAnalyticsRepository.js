import db from "../DB/db.js";

/*
 * Conventions used in every query below:
 * - Only real online attempts count: physical-paper and superseded attempts are excluded.
 * - Correctness comes from student_answers.is_correct, written at submit time by the
 *   shared Unicode-safe grader (utils/grading.js). Rows graded before is_correct
 *   existed fall back to "scored more than zero".
 */
const ONLINE = "aa.is_physical_paper = FALSE AND aa.superseded = FALSE";
const IS_CORRECT = "COALESCE(sa.is_correct, sa.score > 0)";

/** Total available marks of one attempt (sum of its generated questions). */
const ATTEMPT_MARKS = "(SELECT COALESCE(SUM(gq.positive_marks), 0) FROM generated_questions gq WHERE gq.attempt_id = aa.id)";

// ==================== STUDENT OVERVIEW ====================

export const findEnrolledAssessmentsQuery = async (studentId) => {
  const { rows } = await db.query(
    `SELECT a.id, a.title, a.prompt, e.enrolled_at
     FROM enrollments e
     JOIN assessments a ON e.assessment_id = a.id
     WHERE e.student_id = $1
     ORDER BY e.enrolled_at DESC`,
    [studentId]
  );
  return rows;
};

export const findCompletedAssessmentsQuery = async (studentId) => {
  const { rows } = await db.query(
    `SELECT
       a.id,
       a.title,
       aa.completed_at AS submitted_at,
       aa.score AS obtained_score,
       ${ATTEMPT_MARKS} AS total_marks,
       CASE WHEN ${ATTEMPT_MARKS} > 0
            THEN ROUND((aa.score / ${ATTEMPT_MARKS} * 100)::numeric, 2)
            ELSE 0 END AS percentage,
       EXTRACT(EPOCH FROM (aa.completed_at - aa.started_at)) AS time_taken
     FROM assessment_attempts aa
     JOIN assessments a ON aa.assessment_id = a.id
     WHERE aa.student_id = $1 AND aa.status = 'completed' AND aa.completed_at IS NOT NULL AND ${ONLINE}
     ORDER BY aa.completed_at ASC`,
    [studentId]
  );
  return rows.map((r) => ({ ...r, percentage: Number(r.percentage), time_taken: Number(r.time_taken) }));
};

export const findQuestionAnalysisQuery = async (studentId) => {
  const { rows } = await db.query(
    `SELECT
       gq.question_type,
       sa.score AS scored_marks,
       gq.positive_marks,
       CASE
         WHEN sa.score >= gq.positive_marks * 0.8 THEN 'strength'
         WHEN sa.score <= gq.positive_marks * 0.6 THEN 'weakness'
         ELSE 'average'
       END AS performance_category
     FROM student_answers sa
     JOIN generated_questions gq ON sa.question_id = gq.id
     JOIN assessment_attempts aa ON sa.attempt_id = aa.id
     WHERE aa.student_id = $1 AND aa.status = 'completed' AND ${ONLINE} AND sa.score IS NOT NULL`,
    [studentId]
  );
  return rows;
};

// ==================== PERFORMANCE OVER TIME ====================

/** `dateFilter` is one of a fixed set of SQL fragments chosen in the model (never user input). */
export const findPerformanceOverTimeQuery = async (studentId, dateFilter) => {
  const { rows } = await db.query(
    `SELECT
       DATE(aa.completed_at) AS date,
       AVG(CASE WHEN ${ATTEMPT_MARKS} > 0 THEN aa.score / ${ATTEMPT_MARKS} * 100 ELSE 0 END) AS average_score,
       COUNT(*) AS assessments_taken,
       SUM(EXTRACT(EPOCH FROM (aa.completed_at - aa.started_at))) AS total_time
     FROM assessment_attempts aa
     WHERE aa.student_id = $1 AND aa.status = 'completed' AND aa.completed_at IS NOT NULL AND ${ONLINE}
       ${dateFilter}
     GROUP BY DATE(aa.completed_at)
     ORDER BY date ASC`,
    [studentId]
  );
  return rows;
};

// ==================== ASSESSMENT ANALYTICS ====================

export const findAttemptDetailsQuery = async (studentId, assessmentId) => {
  const { rows } = await db.query(
    `SELECT
       aa.id AS attempt_id,
       EXTRACT(EPOCH FROM (aa.completed_at - aa.started_at)) AS time_taken,
       a.title AS assessment_title,
       a.created_at AS assessment_created_at,
       aa.score AS student_score,
       ${ATTEMPT_MARKS} AS total_marks,
       CASE WHEN ${ATTEMPT_MARKS} > 0
            THEN ROUND((aa.score / ${ATTEMPT_MARKS} * 100)::numeric, 2)
            ELSE 0 END AS percentage
     FROM assessment_attempts aa
     JOIN assessments a ON aa.assessment_id = a.id
     WHERE aa.student_id = $1 AND aa.assessment_id = $2
       AND aa.status = 'completed' AND aa.completed_at IS NOT NULL AND ${ONLINE}
     ORDER BY aa.completed_at DESC
     LIMIT 1`,
    [studentId, assessmentId]
  );
  const row = rows[0];
  return row ? { ...row, percentage: Number(row.percentage) } : null;
};

export const findQuestionStatsQuery = async (attemptId) => {
  const { rows } = await db.query(
    `SELECT
       COUNT(gq.id)::int AS total_questions,
       COUNT(*) FILTER (WHERE sa.student_answer IS NOT NULL AND ${IS_CORRECT})::int AS correct_answers,
       COUNT(*) FILTER (WHERE sa.student_answer IS NOT NULL AND NOT ${IS_CORRECT})::int AS incorrect_answers,
       COUNT(*) FILTER (WHERE sa.student_answer IS NULL)::int AS unanswered,
       COALESCE(SUM(CASE WHEN sa.score < 0 THEN -sa.score ELSE 0 END), 0) AS negative_marks_applied
     FROM generated_questions gq
     LEFT JOIN student_answers sa ON sa.question_id = gq.id AND sa.attempt_id = $1
     WHERE gq.attempt_id = $1`,
    [attemptId]
  );
  return rows[0] || null;
};

export const findWeakQuestionsQuery = async (attemptId) => {
  const { rows } = await db.query(
    `SELECT
       gq.question_type,
       gq.question_text,
       (sa.score::NUMERIC / NULLIF(gq.positive_marks, 0)) AS performance,
       sa.score AS scored_marks,
       gq.positive_marks
     FROM student_answers sa
     JOIN generated_questions gq ON sa.question_id = gq.id
     WHERE sa.attempt_id = $1
       AND (sa.score::NUMERIC / NULLIF(gq.positive_marks, 0)) <= 0.6
     ORDER BY performance ASC`,
    [attemptId]
  );
  return rows;
};

export const findStudentAnswerScoresQuery = async (attemptId) => {
  const { rows } = await db.query(`SELECT score FROM student_answers WHERE attempt_id = $1`, [attemptId]);
  return rows;
};

// ==================== LEARNING RECOMMENDATIONS ====================

export const findWeakAreasQuery = async (studentId) => {
  const { rows } = await db.query(
    `SELECT
       gq.question_type,
       COUNT(*) AS question_count,
       AVG(sa.score * 1.0 / NULLIF(gq.positive_marks, 0)) AS average_performance
     FROM student_answers sa
     JOIN generated_questions gq ON sa.question_id = gq.id
     JOIN assessment_attempts aa ON sa.attempt_id = aa.id
     WHERE aa.student_id = $1 AND aa.status = 'completed' AND ${ONLINE}
       AND sa.score IS NOT NULL
       AND sa.score <= gq.positive_marks * 0.6
     GROUP BY gq.question_type
     ORDER BY average_performance ASC
     LIMIT 5`,
    [studentId]
  );
  return rows;
};

export const findRecommendedAssessmentsQuery = async (studentId) => {
  const { rows } = await db.query(
    `SELECT a.id, a.title, a.prompt AS description, NULL AS duration, NULL AS total_marks
     FROM enrollments e
     JOIN assessments a ON e.assessment_id = a.id
     WHERE e.student_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM assessment_attempts aa
         WHERE aa.assessment_id = a.id AND aa.student_id = $1 AND ${ONLINE}
       )
     ORDER BY a.created_at DESC
     LIMIT 3`,
    [studentId]
  );
  return rows;
};

// ==================== ASSESSMENT QUESTIONS (REVIEW) ====================

export const findStudentAttemptIdQuery = async (studentId, assessmentId) => {
  const { rows } = await db.query(
    `SELECT aa.id AS attempt_id
     FROM assessment_attempts aa
     WHERE aa.student_id = $1 AND aa.assessment_id = $2
       AND aa.status = 'completed' AND aa.completed_at IS NOT NULL AND ${ONLINE}
     ORDER BY aa.completed_at DESC
     LIMIT 1`,
    [studentId, assessmentId]
  );
  return rows[0] || null;
};

export const findAttemptQuestionsQuery = async (attemptId) => {
  const { rows } = await db.query(
    `SELECT
       gq.id, gq.question_order, gq.question_text, gq.question_type, gq.options,
       gq.positive_marks, gq.correct_answer, gq.negative_marks,
       sa.student_answer, sa.score, sa.is_correct
     FROM generated_questions gq
     LEFT JOIN student_answers sa ON sa.question_id = gq.id AND sa.attempt_id = $1
     WHERE gq.attempt_id = $1
     ORDER BY gq.question_order`,
    [attemptId]
  );
  return rows;
};

// ==================== STUDENT ASSESSMENT LIST ====================

/**
 * Every assessment the student is enrolled in, with the status of their single
 * online attempt. Physical-paper and superseded attempts are ignored.
 */
export const findEnrolledAssessmentsWithStatusQuery = async (studentId) => {
  const { rows } = await db.query(
    `SELECT
       a.id,
       a.title,
       a.prompt,
       e.enrolled_at,
       a.status         AS assessment_status,
       (a.blueprint IS NOT NULL) AS uses_pool,
       a.languages,
       (SELECT COALESCE(array_agg(pls.language ORDER BY pls.language), '{}')
        FROM pool_language_state pls WHERE pls.assessment_id = a.id AND pls.state = 'ready') AS ready_languages,
       aa.id            AS attempt_id,
       aa.status        AS attempt_status,
       aa.score,
       aa.started_at,
       aa.completed_at,
       blocks.question_count,
       blocks.duration_seconds,
       blocks.planned_marks,
       ${ATTEMPT_MARKS} AS attempt_marks
     FROM enrollments e
     JOIN assessments a ON a.id = e.assessment_id
     LEFT JOIN assessment_attempts aa
       ON aa.assessment_id = a.id AND aa.student_id = e.student_id AND ${ONLINE}
     LEFT JOIN LATERAL (
       SELECT
         COALESCE(SUM(qb.question_count), 0)                            AS question_count,
         COALESCE(SUM(qb.question_count * qb.duration_per_question), 0) AS duration_seconds,
         COALESCE(SUM(qb.question_count * qb.positive_marks), 0)        AS planned_marks
       FROM question_blocks qb WHERE qb.assessment_id = a.id
     ) blocks ON TRUE
     WHERE e.student_id = $1
     ORDER BY e.enrolled_at DESC, a.id DESC`,
    [studentId]
  );
  return rows;
};
