import * as analyticsRepo from "../repositories/instructorAnalyticsRepository.js";
import {
  validateAnalyticsQuery,
  validateAssessmentStudentsQuery,
  validateStudentAttemptQuery,
} from "../validator/instructorAnalytics.validator.js";

// ==================== EXECUTED ASSESSMENTS ====================

/**
 * Fetch executed assessments for an instructor
 */
export const getInstructorExecutedAssessmentsModel = async (instructorId) => {
  // VALIDATE INPUT
  const validationErrors = validateAnalyticsQuery({ instructorId });
  if (validationErrors.length > 0) {
    throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
  }

  const assessments = await analyticsRepo.findExecutedAssessmentsByInstructorQuery(instructorId);
  return assessments;
};

// ==================== ASSESSMENT STUDENTS ====================

/**
 * Fetch students who completed a specific assessment with analytics
 */
export const getAssessmentStudentsModel = async (assessmentId, instructorId) => {
  try {
    // VALIDATE INPUT
    const validationErrors = validateAssessmentStudentsQuery({ assessmentId, instructorId });
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    // Fetch basic student info
    const students = await analyticsRepo.findAssessmentStudentsBasicQuery(assessmentId, instructorId);

    // Fetch correct answer counts
    const correctAnswers = await analyticsRepo.findStudentCorrectAnswersQuery(assessmentId);

    // Create map for quick lookup
    const correctMap = {};
    correctAnswers.forEach((row) => {
      correctMap[row.student_id] = Number(row.correct_answers || 0);
    });

    // Process and calculate analytics for each student
    return students.map((row) => {
      // Calculate time taken
      const timeDiff =
        row.started_at && row.completed_at
          ? Math.round((new Date(row.completed_at) - new Date(row.started_at)) / 1000)
          : 0;
      const minutes = Math.floor(timeDiff / 60);
      const seconds = timeDiff % 60;

      // Calculate percentage
      const percentage =
        row.max_possible_score > 0
          ? Math.round((row.obtained_score / row.max_possible_score) * 100)
          : 0;

      return {
        student_id: row.student_id,
        name: row.name,
        total_questions: Number(row.total_questions),
        correct_answers: correctMap[row.student_id] || 0,
        percentage,
        time_used: `${minutes}m ${seconds}s`,
        time_taken: timeDiff,
      };
    });
  } catch (error) {
    console.error("Error fetching students:", error);
    throw error; // Re-throw instead of returning empty array to surface validation errors
  }
};

// ==================== STUDENT ATTEMPT QUESTIONS ====================

/**
 * Fetch questions and answers for a specific student's attempt
 */
export const getStudentAttemptQuestionsModel = async (assessmentId, studentId, instructorId) => {
  try {
    // VALIDATE INPUT
    const validationErrors = validateStudentAttemptQuery({ assessmentId, studentId, instructorId });
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    // Verify instructor owns the assessment
    const hasAccess = await analyticsRepo.verifyInstructorOwnershipQuery(assessmentId, instructorId);
    if (!hasAccess) {
      throw new Error("Access denied");
    }

    // Get latest completed attempt
    const attempt = await analyticsRepo.findLatestCompletedAttemptQuery(assessmentId, studentId);
    if (!attempt) {
      return [];
    }

    const attemptId = attempt.id;

    // Get all questions with answers
    const questions = await analyticsRepo.findAttemptQuestionsWithAnswersQuery(attemptId);

    // Process each question to determine correctness
    return questions.map((q) => {
      const studentClean = cleanAnswer(q.student_answer);
      const correctClean = cleanAnswer(q.correct_answer);

      const isCorrect = studentClean === correctClean;

      return {
        ...q,
        is_correct: isCorrect,
        score: isCorrect ? q.positive_marks : q.score || -Math.abs(q.negative_marks || 0),
      };
    });
  } catch (error) {
    console.error("Analytics model error:", error);
    throw error;
  }
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Clean and normalize answer for comparison
 */
const cleanAnswer = (answer) => {
  if (answer === null || answer === undefined) return "";
  
  return String(answer)
    .replace(/\\"/g, '"')
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
};