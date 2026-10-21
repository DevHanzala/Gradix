import db from "../DB/db.js";

/**
 * Data access for online assessment attempts. Every function accepts an
 * optional `client` so it can participate in a transaction.
 */

export const findAssessmentForStartQuery = async (assessmentId, client = db) => {
  const { rows } = await client.query(
    `SELECT id, title, prompt, external_links, is_executed, status, blueprint, languages, adaptive, instructor_id, negative_marking
     FROM assessments WHERE id = $1`,
    [assessmentId]
  );
  return rows[0] || null;
};

export const isStudentEnrolledQuery = async (studentId, assessmentId, client = db) => {
  const { rows } = await client.query(
    `SELECT 1 FROM enrollments WHERE student_id = $1 AND assessment_id = $2`,
    [studentId, assessmentId]
  );
  return rows.length > 0;
};

/** The student's single online attempt for this assessment, if any. */
export const findOnlineAttemptQuery = async (studentId, assessmentId, client = db, { forUpdate = false } = {}) => {
  const { rows } = await client.query(
    `SELECT * FROM assessment_attempts
     WHERE student_id = $1 AND assessment_id = $2
       AND is_physical_paper = FALSE AND superseded = FALSE
     ORDER BY started_at ASC
     LIMIT 1
     ${forUpdate ? "FOR UPDATE" : ""}`,
    [studentId, assessmentId]
  );
  return rows[0] || null;
};

export const findAttemptByIdQuery = async (attemptId, client = db, { forUpdate = false } = {}) => {
  const { rows } = await client.query(
    `SELECT * FROM assessment_attempts WHERE id = $1 ${forUpdate ? "FOR UPDATE" : ""}`,
    [attemptId]
  );
  return rows[0] || null;
};

// Timing timestamps come from the app server clock (not the DB's NOW()) so
// every timing comparison uses one clock.
export const insertAttemptQuery = async ({ studentId, assessmentId, language, plan, adaptive = false, difficulty = null }, client = db) => {
  const now = new Date();
  const { rows } = await client.query(
    `INSERT INTO assessment_attempts
       (student_id, assessment_id, attempt_number, language, status,
        is_physical_paper, current_question_index, current_question_started_at, started_at,
        plan, adaptive, current_difficulty)
     VALUES ($1, $2, 1, $3, 'in_progress', FALSE, 0, $4, $4, $5, $6, $7)
     RETURNING *`,
    [studentId, assessmentId, language, now, plan ? JSON.stringify(plan) : null, adaptive, difficulty]
  );
  return rows[0];
};

/** Settings that affect what a student sees during an attempt. */
export const findAttemptSettingsQuery = async (assessmentId, client = db) => {
  const { rows } = await client.query(`SELECT show_live_score, adaptive FROM assessments WHERE id = $1`, [assessmentId]);
  return rows[0] || { show_live_score: false, adaptive: false };
};

export const insertGeneratedQuestionQuery = async (attemptId, order, q, client = db) => {
  const { rows } = await client.query(
    `INSERT INTO generated_questions
       (attempt_id, question_order, question_type, question_text, options,
        correct_answer, positive_marks, negative_marks, duration_per_question,
        objective_id, difficulty, language, source_chunk_ids, stem_hash, pool_question_id, served_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     ON CONFLICT (attempt_id, question_order) DO NOTHING
     RETURNING id`,
    [
      attemptId,
      order,
      q.question_type,
      q.question_text,
      q.options ? JSON.stringify(q.options) : null,
      JSON.stringify(q.correct_answer),
      q.positive_marks,
      q.negative_marks,
      q.duration_per_question,
      q.objective_id ?? null,
      q.difficulty ?? null,
      q.language ?? null,
      q.source_chunk_ids ?? null,
      q.stem_hash ?? null,
      q.pool_question_id ?? null,
      q.served_at ?? null,
    ]
  );
  return rows[0] || null;
};

export const markAssessmentExecutedQuery = async (assessmentId, client = db) => {
  await client.query(
    `UPDATE assessments SET is_executed = TRUE, updated_at = NOW()
     WHERE id = $1 AND is_executed = FALSE`,
    [assessmentId]
  );
};

/** Questions for an attempt. `includeAnswers` must only be true for grading/review. */
export const findAttemptQuestionsQuery = async (attemptId, { includeAnswers = false } = {}, client = db) => {
  const answerColumn = includeAnswers ? ", correct_answer" : "";
  const { rows } = await client.query(
    `SELECT id, question_order, question_type, question_text, options,
            positive_marks, negative_marks, duration_per_question,
            objective_id, difficulty, pool_question_id, served_at${answerColumn}
     FROM generated_questions
     WHERE attempt_id = $1
     ORDER BY question_order ASC, id ASC`,
    [attemptId]
  );
  return rows;
};

export const findSavedAnswersQuery = async (attemptId, client = db) => {
  const { rows } = await client.query(
    `SELECT question_id, student_answer, answered_at, score, is_correct, graded_at, time_taken_seconds, timed_out
     FROM student_answers WHERE attempt_id = $1`,
    [attemptId]
  );
  return rows;
};

export const upsertAnswerQuery = async ({ attemptId, questionId, answer }, client = db) => {
  const { rows } = await client.query(
    `INSERT INTO student_answers (attempt_id, question_id, student_answer, answered_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (attempt_id, question_id)
     DO UPDATE SET student_answer = EXCLUDED.student_answer, answered_at = NOW()
     RETURNING question_id, student_answer, answered_at`,
    [attemptId, questionId, answer]
  );
  return rows[0];
};

/** Grade a closed question (keeps the student's last saved answer). */
export const gradeAnswerQuery = async ({ attemptId, questionId, answer, score, isCorrect, timeTaken, timedOut }, client = db) => {
  const { rows } = await client.query(
    `INSERT INTO student_answers (attempt_id, question_id, student_answer, score, is_correct, time_taken_seconds, timed_out, graded_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (attempt_id, question_id)
     DO UPDATE SET score = EXCLUDED.score, is_correct = EXCLUDED.is_correct,
                   time_taken_seconds = EXCLUDED.time_taken_seconds, timed_out = EXCLUDED.timed_out, graded_at = NOW()
     RETURNING question_id, student_answer, answered_at, score, is_correct, graded_at, time_taken_seconds, timed_out`,
    [attemptId, questionId, answer, score, isCorrect, timeTaken, timedOut]
  );
  return rows[0];
};

/** Move the attempt to a slot. `startedAt` null = waiting for the question to be served. */
export const updateAttemptServingQuery = async (attemptId, { index, startedAt, addDelayMs = 0, difficulty = null }, client = db) => {
  await client.query(
    `UPDATE assessment_attempts
     SET current_question_index = $2, current_question_started_at = $3,
         serve_delay_ms = serve_delay_ms + $4, current_difficulty = COALESCE($5, current_difficulty)
     WHERE id = $1`,
    [attemptId, index, startedAt, Math.round(addDelayMs), difficulty]
  );
};

export const completeAttemptQuery = async (attemptId, scores, client = db) => {
  const { rows } = await client.query(
    `UPDATE assessment_attempts
     SET status = 'completed', completed_at = $2, score = $3,
         raw_score = $3, raw_percentage = $4, adjusted_score = $5, adjusted_percentage = $6, difficulty_path = $7
     WHERE id = $1
     RETURNING *`,
    [
      attemptId,
      new Date(),
      scores.rawScore,
      scores.rawPercentage,
      scores.adjustedScore,
      scores.adjustedPercentage,
      scores.difficultyPath ? JSON.stringify(scores.difficultyPath) : null,
    ]
  );
  return rows[0];
};
