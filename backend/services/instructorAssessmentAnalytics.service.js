import {
  getInstructorExecutedAssessmentsModel,
  getAssessmentStudentsModel,
  getStudentAttemptQuestionsModel,
} from "../models/InstructorAssessmentAnalyticsModel.js";
import { redis } from "../DB/redis.js";
import pool from "../DB/db.js";

// ==================== SERVICE FUNCTIONS ====================

// 1. GET INSTRUCTOR EXECUTED ASSESSMENTS SERVICE
export const getInstructorExecutedAssessmentsService = async (instructorId, userRole) => {
  if (!instructorId || userRole !== "instructor") {
    throw new Error("UNAUTHORIZED_ROLE");
  }

  const assessments = await getInstructorExecutedAssessmentsModel(instructorId);

  if (!assessments || assessments.length === 0) {
    return [];
  }

  return assessments;
};

// 2. GET ASSESSMENT STUDENTS SERVICE
export const getAssessmentStudentsService = async (assessmentId, instructorId, userRole) => {
  if (!instructorId || userRole !== "instructor" || isNaN(assessmentId)) {
    throw new Error("INVALID_REQUEST");
  }

  const cacheKey = `analytics:students:${assessmentId}`;

  // Check Redis cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    console.log(`Students list from Redis for assessment ${assessmentId}`);
    return { data: cached, fromCache: true };
  }

  const students = await getAssessmentStudentsModel(assessmentId, instructorId);

  // Cache for 5 minutes
  await redis.set(cacheKey, students || [], { ex: 300 });

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

  if (!questions || questions.length === 0) {
    return [];
  }

  return questions;
};

// 4. GET INSTRUCTOR OVERVIEW SERVICE
export const getInstructorOverviewService = async (instructorId) => {
  // Get assessment count
  const assessmentQuery = `
    SELECT COUNT(*) as assessment_count
    FROM assessments
    WHERE instructor_id = $1
  `;
  const assessmentResult = await pool.query(assessmentQuery, [instructorId]);

  // Get executed assessment count
  const executedAssessmentQuery = `
    SELECT COUNT(*) as executed_count
    FROM assessments
    WHERE instructor_id = $1 AND is_executed = TRUE
  `;
  const executedResult = await pool.query(executedAssessmentQuery, [instructorId]);

  // Get resource count
  const resourceQuery = `
    SELECT COUNT(*) as resource_count
    FROM resources
    WHERE uploaded_by = $1
  `;
  const resourceResult = await pool.query(resourceQuery, [instructorId]);

  const overview = {
    assessments: parseInt(assessmentResult.rows[0].assessment_count, 10),
    executedAssessments: parseInt(executedResult.rows[0].executed_count, 10),
    resources: parseInt(resourceResult.rows[0].resource_count, 10),
  };

  
  return overview;
};