import db from "../DB/db.js";
import { AppError } from "../utils/AppError.js";

/**
 * Central access check for instructor-side assessment routes.
 *
 * - The assessment must exist (404 otherwise).
 * - Only its owner, or a super_admin, may access it (403 otherwise).
 * - With `lockAfterExecution`, mutations are refused once any student has
 *   started it (409 ASSESSMENT_LOCKED), because students' questions and
 *   results already depend on its configuration.
 */
export const requireAssessmentAccess = async (assessmentId, user, { lockAfterExecution = false } = {}) => {
  const id = Number.parseInt(assessmentId, 10);
  if (!Number.isInteger(id)) {
    throw new AppError("INVALID_ASSESSMENT_ID", 400, "Invalid assessment ID");
  }

  const { rows } = await db.query(
    `SELECT id, title, prompt, external_links, instructor_id, is_executed FROM assessments WHERE id = $1`,
    [id]
  );
  const assessment = rows[0];
  if (!assessment) {
    throw new AppError("ASSESSMENT_NOT_FOUND", 404, "Assessment not found");
  }

  const isOwner = assessment.instructor_id === user.id;
  if (!isOwner && user.role !== "super_admin") {
    throw new AppError("ASSESSMENT_FORBIDDEN", 403, "You do not have access to this assessment");
  }

  if (lockAfterExecution && assessment.is_executed) {
    throw new AppError(
      "ASSESSMENT_LOCKED",
      409,
      "This assessment has already been started by students and can no longer be changed"
    );
  }

  return assessment;
};
