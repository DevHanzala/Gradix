import db from "../DB/db.js";

/*
 * Conventions used in every query below:
 * - Only real online attempts count: physical-paper and superseded attempts are excluded.
 * - Correctness comes from student_answers.is_correct, written at submit time by the
 *   shared Unicode-safe grader (utils/grading.js). Rows graded before is_correct
 *   existed fall back to "scored more than zero".
 */
const ONLINE = "aa.is_physical_paper = FALSE AND aa.superseded = FALSE";

/** Total available marks of one attempt (sum of its generated questions). */
const ATTEMPT_MARKS = "(SELECT COALESCE(SUM(gq.positive_marks), 0) FROM generated_questions gq WHERE gq.attempt_id = aa.id)";

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
       aa.raw_percentage,
       (SELECT COALESCE(SUM((slot->>'positive_marks')::numeric), 0) FROM jsonb_array_elements(aa.plan) slot) AS plan_marks,
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
