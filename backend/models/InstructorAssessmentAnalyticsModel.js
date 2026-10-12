import * as analyticsRepo from "../repositories/instructorAnalyticsRepository.js";
import { toReviewItem } from "../utils/grading.js";
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
          ? Math.round((Number(row.obtained_score) / Number(row.max_possible_score)) * 100)
          : 0;

      return {
        student_id: row.student_id,
        name: row.name,
        total_questions: Number(row.total_questions),
        correct_answers: Number(row.correct_answers) || 0,
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

    // Same grading function as submission (Unicode-safe).
    return questions.map(toReviewItem);
  } catch (error) {
    console.error("Analytics model error:", error);
    throw error;
  }
};
