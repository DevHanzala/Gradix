import db from "../DB/db.js";
import { generateAssessmentQuestions } from "../models/assessmentModel.js";

// ==================== SERVICE FUNCTIONS ====================

// 1. START ASSESSMENT FOR STUDENT SERVICE
export const startAssessmentForStudentService = async (studentId, assessmentId, language = "en") => {
  // Check if assessment exists
  const { rows: assessRows } = await db.query(
    `SELECT id, title, prompt, external_links, is_executed
     FROM assessments WHERE id = $1`,
    [assessmentId]
  );
  
  if (assessRows.length === 0) {
    console.warn(`⚠️ Assessment ${assessmentId} not found in database`);
    throw new Error("ASSESSMENT_NOT_FOUND");
  }
  
  const assessment = assessRows[0];

  // Fetch question blocks to determine types, counts, durations, and marks
  const { rows: blockRows } = await db.query(
    `SELECT question_type, question_count, duration_per_question, num_options, positive_marks, negative_marks
     FROM question_blocks WHERE assessment_id = $1`,
    [assessmentId]
  );
  
  if (blockRows.length === 0) {
    console.warn(`⚠️ No question blocks defined for assessment ${assessmentId}. Using defaults.`);
    blockRows.push({
      question_type: "multiple_choice",
      question_count: 5,
      duration_per_question: 120,
      positive_marks: 1,
      negative_marks: 0,
    });
  }

  const numQuestions = blockRows.reduce((sum, b) => sum + b.question_count, 0);
  const typeCountsStr = blockRows.map((b) => `${b.question_count} ${b.question_type}`).join(", ");
  const totalDuration = blockRows.reduce(
    (sum, b) => sum + b.question_count * (b.duration_per_question || 120),
    0
  );

  // Set is_executed to true if not already
  if (!assessment.is_executed) {
    console.log(`🔄 Updating is_executed to true for assessment ${assessmentId}`);
    await db.query(
      `UPDATE assessments SET is_executed = true, updated_at = NOW() WHERE id = $1`,
      [assessmentId]
    );
  } else {
    console.log(`ℹ️ Assessment ${assessmentId} already has is_executed = true`);
  }

  // Validate enrollment
  const { rows: enrollRows } = await db.query(
    `SELECT 1 FROM enrollments WHERE student_id = $1 AND assessment_id = $2`,
    [studentId, assessmentId]
  );
  
  if (enrollRows.length === 0) {
    console.warn(`⚠️ Student ${studentId} not enrolled for assessment ${assessmentId}`);
    throw new Error("NOT_ENROLLED");
  }

  // Check for existing in-progress attempt
  const { rows: existingAttempt } = await db.query(
    `SELECT id FROM assessment_attempts WHERE student_id = $1 AND assessment_id = $2 AND status = 'in_progress'`,
    [studentId, assessmentId]
  );
  
  if (existingAttempt.length > 0) {
    console.warn(`⚠️ In-progress attempt exists for student ${studentId}, assessment ${assessmentId}`);
    throw new Error("ALREADY_IN_PROGRESS");
  }

  // Create attempt
  const { rows: attemptRows } = await db.query(
    `INSERT INTO assessment_attempts (student_id, assessment_id, attempt_number, started_at, language, status)
     VALUES ($1, $2, 1, NOW(), $3, 'in_progress') RETURNING id`,
    [studentId, assessmentId, language]
  );
  
  const attemptId = attemptRows[0].id;
  // Generate questions using the assessmentModel
  await generateAssessmentQuestions(assessmentId, attemptId, language, assessment);

  // Fetch generated questions
  const { rows: questionRows } = await db.query(
    `SELECT id, question_type, question_text, options, correct_answer, positive_marks, negative_marks, duration_per_question
     FROM generated_questions WHERE attempt_id = $1 ORDER BY question_order`,
    [attemptId]
  );

  return {
    attemptId,
    duration: totalDuration,
    questions: questionRows,
  };
};

// 2. SUBMIT ASSESSMENT FOR STUDENT SERVICE
export const submitAssessmentForStudentService = async (
  studentId,
  assessmentId,
  attemptId,
  answers
) => {

  // Validate attempt
  const { rows: attemptRows } = await db.query(
    `SELECT id, assessment_id, student_id, status
     FROM assessment_attempts WHERE id = $1 AND student_id = $2 AND assessment_id = $3 AND status = 'in_progress'`,
    [attemptId, studentId, assessmentId]
  );
  
  if (attemptRows.length === 0) {
    throw new Error("INVALID_ATTEMPT");
  }

  // Fetch all questions for the attempt
  const { rows: questionRows } = await db.query(
    `SELECT id, question_type, correct_answer, positive_marks, negative_marks
     FROM generated_questions WHERE attempt_id = $1 ORDER BY question_order`,
    [attemptId]
  );

  let totalScore = 0;
  const evaluatedAnswers = [];

  for (const q of questionRows) {
    const submittedAnswer = answers.find((a) => a.questionId === q.id);
    const studentAnswer = submittedAnswer ? submittedAnswer.answer : null;

    let isCorrect = false;

    // Smart comparison for all types
    if (q.question_type === "short_answer") {
      const rule =
        typeof q.correct_answer === "string"
          ? JSON.parse(q.correct_answer)
          : q.correct_answer;

      isCorrect = evaluateShortAnswer(studentAnswer, rule);
    } else {
      // TRUE/FALSE & MCQ: Smart string comparison
      const clean = (val) => {
        if (val === null || val === undefined) return "";
        return String(val).trim().toLowerCase().replace(/\\"/g, '"');
      };
      isCorrect = clean(q.correct_answer) === clean(studentAnswer);
    }

    // Fixed scoring logic
    const score = isCorrect
      ? parseFloat(q.positive_marks || 1)
      : studentAnswer !== null && studentAnswer !== undefined
      ? -Math.abs(parseFloat(q.negative_marks || 0))
      : 0;

    totalScore += score;

    evaluatedAnswers.push({
      questionId: q.id,
      answer: studentAnswer,
      correctAnswer: q.correct_answer,
      score: score,
      correct: isCorrect,
    });

    // Save to DB
    await db.query(
      `INSERT INTO student_answers (attempt_id, question_id, student_answer, score)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (attempt_id, question_id) DO UPDATE
       SET student_answer = $3, score = $4`,
      [
        attemptId,
        q.id,
        studentAnswer !== null
          ? q.question_type === "short_answer"
            ? JSON.stringify(studentAnswer)
            : studentAnswer
          : null,
        score,
      ]
    );
  }

  // Prevent negative total score
  totalScore = Math.max(0, totalScore);

  // Update attempt
  await db.query(
    `UPDATE assessment_attempts 
     SET status = 'completed', completed_at = NOW(), score = $1
     WHERE id = $2`,
    [totalScore, attemptId]
  );

  return {
    attemptId,
    score: totalScore,
    answers: evaluatedAnswers,
  };
};

// 3. GET SUBMISSION DETAILS FOR STUDENT SERVICE
export const getSubmissionDetailsForStudentService = async (studentId, submissionId) => {
  const { rows: attemptRows } = await db.query(
    `SELECT aa.*, a.title AS assessment_title
     FROM assessment_attempts aa
     JOIN assessments a ON aa.assessment_id = a.id
     WHERE aa.id = $1 AND aa.student_id = $2`,
    [submissionId, studentId]
  );
  
  if (attemptRows.length === 0) {
    console.warn(`⚠️ Submission ${submissionId} not found for student ${studentId}`);
    throw new Error("SUBMISSION_NOT_FOUND");
  }

  const { rows: answerRows } = await db.query(
    `SELECT sa.*, gq.question_text, gq.question_type, gq.correct_answer, gq.positive_marks, gq.negative_marks
     FROM student_answers sa
     JOIN generated_questions gq ON sa.question_id = gq.id
     WHERE sa.attempt_id = $1`,
    [submissionId]
  );

  return {
    attempt: attemptRows[0],
    answers: answerRows,
  };
};

// 4. GET ASSESSMENT FOR INSTRUCTOR PRINT SERVICE
export const getAssessmentForInstructorPrintService = async (assessmentId, userId) => {
  let attemptId;

  try {

    // Fetch assessment + question blocks
    const { rows: assessmentRows } = await db.query(
      `SELECT a.id, a.title, a.instructor_id, a.prompt, a.external_links
       FROM assessments a
       WHERE a.id = $1 AND a.instructor_id = $2`,
      [assessmentId, userId]
    );

    if (assessmentRows.length === 0) {
      throw new Error("ASSESSMENT_NOT_FOUND");
    }

    const assessment = assessmentRows[0];

    // Fetch question blocks
    const { rows: blockRows } = await db.query(
      `SELECT question_type, question_count, duration_per_question, num_options, positive_marks, negative_marks
       FROM question_blocks WHERE assessment_id = $1`,
      [assessmentId]
    );

    if (blockRows.length === 0) {
      throw new Error("NO_QUESTION_BLOCKS");
    }

    // Create temp attempt
    const { rows: attemptRows } = await db.query(
      `INSERT INTO assessment_attempts 
       (assessment_id, student_id, attempt_number, started_at, language, status, is_physical_paper)
       VALUES ($1, $2, 1, NOW(), $3, 'in_progress', $4)
       RETURNING id`,
      [assessmentId, userId, "en", true]
    );
    
    attemptId = attemptRows[0].id;

    // Generate questions
    const { questions, duration } = await generateAssessmentQuestions(
      assessmentId,
      attemptId,
      "en",
      assessment
    );

    const totalMarks = questions.reduce((sum, q) => sum + (q.positive_marks || 0), 0);

    // Mark as completed
    await db.query(
      `UPDATE assessment_attempts SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [attemptId]
    );

    return {
      questions,
      duration,
      totalMarks,
      assessmentTitle: assessment.title,
    };
  } catch (error) {
    // Cleanup on error
    if (attemptId) {
      await db.query(`DELETE FROM assessment_attempts WHERE id = $1`, [attemptId]).catch(() =>
        console.error("Cleanup failed")
      );
    }
    throw error;
  }
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Normalize text for comparison
 */
const normalizeText = (text = "") =>
  text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Evaluate short answer based on required keywords and minimum matches
 */
const evaluateShortAnswer = (studentAnswer, rule) => {
  if (!studentAnswer || !rule) return false;

  const answer = normalizeText(studentAnswer);

  const required = rule.required_keywords || [];
  const minMatch = rule.min_required_match || required.length;

  let matched = 0;

  for (const keyword of required) {
    if (answer.includes(normalizeText(keyword))) {
      matched++;
    }
  }

  return matched >= minMatch;
};