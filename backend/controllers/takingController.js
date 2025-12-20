import db from "../DB/db.js";
import { generateAssessmentQuestions } from "../models/assessmentModel.js";

const normalizeText = (text = "") =>
  text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const evaluateShortAnswer = (studentAnswer, rule) => {
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


export const startAssessmentForStudent = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { assessmentId } = req.params;
    const { language = "en" } = req.body || {};

    console.log(`📝 Starting assessment ${assessmentId} for student ${studentId} in language ${language}`);

    // Check if assessment exists
    const { rows: assessRows } = await db.query(
      `SELECT id, title, prompt, external_links, is_executed
       FROM assessments WHERE id = $1`,
      [assessmentId]
    );
    if (assessRows.length === 0) {
      console.warn(`⚠️ Assessment ${assessmentId} not found in database`);
      return res.status(404).json({ success: false, message: "Assessment not found" });
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
      blockRows.push({ question_type: "multiple_choice", question_count: 5, duration_per_question: 120, positive_marks: 1, negative_marks: 0 });
    }

    const questionTypes = [...new Set(blockRows.map(b => b.question_type))];
    const numQuestions = blockRows.reduce((sum, b) => sum + b.question_count, 0);
    const typeCountsStr = blockRows.map(b => `${b.question_count} ${b.question_type}`).join(", ");
    const totalDuration = blockRows.reduce((sum, b) => sum + b.question_count * (b.duration_per_question || 120), 0);

    console.log(`📊 Using instructor-defined questions: ${typeCountsStr} (total ${numQuestions}, duration ${totalDuration} seconds)`);

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
      return res.status(403).json({ success: false, message: "You are not enrolled for this assessment" });
    }

    // Check for existing in-progress attempt
    const { rows: existingAttempt } = await db.query(
      `SELECT id FROM assessment_attempts WHERE student_id = $1 AND assessment_id = $2 AND status = 'in_progress'`,
      [studentId, assessmentId]
    );
    if (existingAttempt.length > 0) {
      console.warn(`⚠️ In-progress attempt exists for student ${studentId}, assessment ${assessmentId}`);
      return res.status(400).json({ success: false, message: "Assessment already in progress" });
    }

    // Create attempt
    const { rows: attemptRows } = await db.query(
      `INSERT INTO assessment_attempts (student_id, assessment_id, attempt_number, started_at, language, status)
       VALUES ($1, $2, 1, NOW(), $3, 'in_progress') RETURNING id`,
      [studentId, assessmentId, language]
    );
    const attemptId = attemptRows[0].id;
    console.log(`✅ Created attempt ${attemptId} for assessment ${assessmentId}`);

    // Generate questions using the assessmentModel
    await generateAssessmentQuestions(assessmentId, attemptId, language, assessment);

    // Fetch generated questions (options is already JSONB, no need for JSON.parse)
    const { rows: questionRows } = await db.query(
      `SELECT id, question_type, question_text, options, correct_answer, positive_marks, negative_marks, duration_per_question
       FROM generated_questions WHERE attempt_id = $1 ORDER BY question_order`,
      [attemptId]
    );

    res.status(200).json({
      success: true,
      message: "Assessment started successfully",
      data: {
        attemptId,
        duration: totalDuration,
        questions: questionRows,
      },
    });
  } catch (error) {
    console.error("❌ startAssessmentForStudent error:", error.message, error.stack);
    res.status(500).json({ success: false, message: "Failed to start assessment" });
  }
};

export const submitAssessmentForStudent = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { assessmentId } = req.params;
    const { attemptId, answers, language } = req.body;

    console.log(`Submitting assessment ${assessmentId} for student ${studentId}, attempt ${attemptId}`);

    // Validate attempt
    const { rows: attemptRows } = await db.query(
      `SELECT id, assessment_id, student_id, status
       FROM assessment_attempts WHERE id = $1 AND student_id = $2 AND assessment_id = $3 AND status = 'in_progress'`,
      [attemptId, studentId, assessmentId]
    );
    if (attemptRows.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid attempt or assessment not in progress" });
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

      // SMART COMPARISON FOR ALL TYPES
      if (q.question_type === "short_answer") {
        const rule = typeof q.correct_answer === "string"
          ? JSON.parse(q.correct_answer)
          : q.correct_answer;

        isCorrect = evaluateShortAnswer(studentAnswer, rule);
      }
      else {
        // TRUE/FALSE & MCQ: Smart string comparison
        const clean = (val) => {
          if (val === null || val === undefined) return "";
          return String(val).trim().toLowerCase().replace(/\\"/g, '"');
        };
        isCorrect = clean(q.correct_answer) === clean(studentAnswer);
      }

      // FIXED SCORING LOGIC — THIS WAS THE BUG
      const score = isCorrect
        ? parseFloat(q.positive_marks || 1)                                    // Correct → +marks
        : (studentAnswer !== null && studentAnswer !== undefined               // Wrong & answered → -marks
          ? -Math.abs(parseFloat(q.negative_marks || 0))
          : 0);                                                              // Unanswered → 0

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
            ? (q.question_type === "short_answer" ? JSON.stringify(studentAnswer) : studentAnswer) 
            : null, 
          score
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
    console.log(`Assessment submitted successfully. Final score: ${totalScore}`);

    res.status(200).json({
      success: true,
      message: "Assessment submitted successfully",
      data: { attemptId, score: totalScore, answers: evaluatedAnswers },
    });
  } catch (error) {
    console.error("submitAssessmentForStudent error:", error);
    res.status(500).json({ success: false, message: "Failed to submit assessment" });
  }
};


export const getSubmissionDetailsForStudent = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { submissionId } = req.params;

    console.log(`📋 Fetching submission ${submissionId} for student ${studentId}`);

    const { rows: attemptRows } = await db.query(
      `SELECT aa.*, a.title AS assessment_title
       FROM assessment_attempts aa
       JOIN assessments a ON aa.assessment_id = a.id
       WHERE aa.id = $1 AND aa.student_id = $2`,
      [submissionId, studentId]
    );
    if (attemptRows.length === 0) {
      console.warn(`⚠️ Submission ${submissionId} not found for student ${studentId}`);
      return res.status(404).json({ success: false, message: "Submission not found" });
    }

    const { rows: answerRows } = await db.query(
      `SELECT sa.*, gq.question_text, gq.question_type, gq.correct_answer, gq.positive_marks, gq.negative_marks
       FROM student_answers sa
       JOIN generated_questions gq ON sa.question_id = gq.id
       WHERE sa.attempt_id = $1`,
      [submissionId]
    );

    res.status(200).json({
      success: true,
      message: "Submission details retrieved successfully",
      data: {
        attempt: attemptRows[0],
        answers: answerRows,
      },
    });
  } catch (error) {
    console.error("❌ getSubmissionDetailsForStudent error:", error.message, error.stack);
    res.status(500).json({ success: false, message: "Failed to retrieve submission details" });
  }
};

export const getAssessmentForInstructorPrint = async (req, res) => {
  let attemptId;
  try {
    const { assessmentId } = req.params;
    const userId = req.user.id;

    console.log(`Generating data for physical paper: assessment ${assessmentId}, instructor ${userId}`);

    // Fetch assessment + question blocks
    const { rows: assessmentRows } = await db.query(
      `SELECT a.id, a.title, a.instructor_id, a.prompt, a.external_links
       FROM assessments a
       WHERE a.id = $1 AND a.instructor_id = $2`,
      [assessmentId, userId]
    );

    if (assessmentRows.length === 0) {
      return res.status(404).json({ success: false, message: "Assessment not found or access denied" });
    }

    const assessment = assessmentRows[0];

    // FETCH QUESTION BLOCKS — THIS WAS MISSING
    const { rows: blockRows } = await db.query(
      `SELECT question_type, question_count, duration_per_question, num_options, positive_marks, negative_marks
       FROM question_blocks WHERE assessment_id = $1`,
      [assessmentId]
    );

    if (blockRows.length === 0) {
      return res.status(400).json({ success: false, message: "No question blocks defined for this assessment" });
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
    console.log(`Temp attempt created: ${attemptId}`);

    // Pass question_blocks properly
    const { questions, duration } = await generateAssessmentQuestions(
      assessmentId,
      attemptId,
      "en",
      assessment,
    );

    const totalMarks = questions.reduce((sum, q) => sum + (q.positive_marks || 0), 0);

    // Mark as completed
    await db.query(
      `UPDATE assessment_attempts SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [attemptId]
    );

    res.json({
      success: true,
      questions,
      duration,
      totalMarks,
      assessmentTitle: assessment.title
    });

  } catch (error) {
    console.error("getAssessmentForInstructorPrint error:", error);
    if (attemptId) {
      await db.query(`DELETE FROM assessment_attempts WHERE id = $1`, [attemptId])
        .catch(() => console.error("Cleanup failed"));
    }
    res.status(500).json({ success: false, message: "Failed to generate paper data" });
  }
};
