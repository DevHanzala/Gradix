import {
  getInstructorExecutedAssessmentsModel,
  getAssessmentStudentsModel,
  getStudentAttemptQuestionsModel,
} from "../models/InstructorAssessmentAnalyticsModel.js";
import pool from "../DB/db.js";

// ==================== SERVICE FUNCTIONS ====================

// 1. GET INSTRUCTOR EXECUTED ASSESSMENTS SERVICE
export const getInstructorExecutedAssessmentsService = async (instructorId, userRole) => {
  if (!instructorId || userRole !== "instructor") {
    throw new Error("UNAUTHORIZED_ROLE");
  }

  const assessments = await getInstructorExecutedAssessmentsModel(instructorId);
  return assessments || [];
};

// 2. GET ASSESSMENT STUDENTS SERVICE — Redis removed, always hits DB
export const getAssessmentStudentsService = async (assessmentId, instructorId, userRole) => {
  if (!instructorId || userRole !== "instructor" || isNaN(assessmentId)) {
    throw new Error("INVALID_REQUEST");
  }

  const students = await getAssessmentStudentsModel(assessmentId, instructorId);
  return { data: students || [], fromCache: false };
};

// 3. GET STUDENT ATTEMPT QUESTIONS SERVICE
export const getStudentAttemptQuestionsService = async (
  assessmentId,
  studentId,
  instructorId,
  userRole
) => {
  if (!instructorId || userRole !== "instructor") {
    throw new Error("UNAUTHORIZED_ROLE");
  }

  if (isNaN(assessmentId) || isNaN(studentId)) {
    throw new Error("INVALID_IDS");
  }

  const questions = await getStudentAttemptQuestionsModel(
    assessmentId,
    studentId,
    instructorId
  );

  return questions || [];
};

// 4. GET INSTRUCTOR OVERVIEW SERVICE — direct DB queries, no Redis
export const getInstructorOverviewService = async (instructorId) => {
  const assessmentResult = await pool.query(
    `SELECT COUNT(*) as assessment_count FROM assessments WHERE instructor_id = $1`,
    [instructorId]
  );

  const executedResult = await pool.query(
    `SELECT COUNT(*) as executed_count FROM assessments WHERE instructor_id = $1 AND is_executed = TRUE`,
    [instructorId]
  );

  const resourceResult = await pool.query(
    `SELECT COUNT(*) as resource_count FROM resources WHERE uploaded_by = $1`,
    [instructorId]
  );

  return {
    assessments: parseInt(assessmentResult.rows[0].assessment_count, 10),
    executedAssessments: parseInt(executedResult.rows[0].executed_count, 10),
    resources: parseInt(resourceResult.rows[0].resource_count, 10),
  };
};