import pool from "../DB/db.js" // Import the database pool

/**
 * Creates a new submission in the database.
 * @param {number} studentId - The ID of the student submitting.
 * @param {number} assignmentId - The ID of the assignment being submitted.
 * @param {string} submissionFileUrl - URL to the submitted file (optional).
 * @returns {Promise<Object>} The newly created submission object.
 */
export const createSubmission = async (studentId, assignmentId, submissionFileUrl = null) => {
  const query = `
    INSERT INTO submissions (student_id, assignment_id, submission_file_url) 
    VALUES ($1, $2, $3) 
    RETURNING id, student_id, assignment_id, submission_file_url, grade, feedback, submitted_at
  `
  const { rows } = await pool.query(query, [studentId, assignmentId, submissionFileUrl])
  return rows[0]
}

/**
 * Updates an existing submission.
 * @param {number} submissionId - The ID of the submission to update.
 * @param {string} submissionFileUrl - New URL to the submitted file.
 * @returns {Promise<Object|undefined>} The updated submission object.
 */
export const updateSubmission = async (submissionId, submissionFileUrl) => {
  const query = `
    UPDATE submissions 
    SET submission_file_url = $1, submitted_at = CURRENT_TIMESTAMP 
    WHERE id = $2 
    RETURNING id, student_id, assignment_id, submission_file_url, grade, feedback, submitted_at
  `
  const { rows } = await pool.query(query, [submissionFileUrl, submissionId])
  return rows[0]
}

/**
 * Finds a submission by student and assignment ID.
 * @param {number} studentId - The ID of the student.
 * @param {number} assignmentId - The ID of the assignment.
 * @returns {Promise<Object|undefined>} The submission object if found.
 */
export const findSubmissionByStudentAndAssignment = async (studentId, assignmentId) => {
  const query = `
    SELECT s.*, u.name as student_name, a.title as assignment_title
    FROM submissions s
    JOIN users u ON s.student_id = u.id
    JOIN assignments a ON s.assignment_id = a.id
    WHERE s.student_id = $1 AND s.assignment_id = $2
  `
  const { rows } = await pool.query(query, [studentId, assignmentId])
  return rows[0]
}

/**
 * Gets all submissions for a specific assignment.
 * @param {number} assignmentId - The ID of the assignment.
 * @returns {Promise<Array>} Array of submissions for the assignment.
 */
export const getSubmissionsByAssignment = async (assignmentId) => {
  const query = `
    SELECT s.*, u.name as student_name, u.email as student_email
    FROM submissions s
    JOIN users u ON s.student_id = u.id
    WHERE s.assignment_id = $1
    ORDER BY s.submitted_at DESC
  `
  const { rows } = await pool.query(query, [assignmentId])
  return rows
}

/**
 * Gets all submissions by a specific student.
 * @param {number} studentId - The ID of the student.
 * @returns {Promise<Array>} Array of submissions by the student.
 */
export const getSubmissionsByStudent = async (studentId) => {
  const query = `
    SELECT s.*, a.title as assignment_title, c.title as course_title
    FROM submissions s
    JOIN assignments a ON s.assignment_id = a.id
    JOIN courses c ON a.course_id = c.id
    WHERE s.student_id = $1
    ORDER BY s.submitted_at DESC
  `
  const { rows } = await pool.query(query, [studentId])
  return rows
}

/**
 * Grades a submission and adds feedback.
 * @param {number} submissionId - The ID of the submission to grade.
 * @param {string} grade - The grade to assign.
 * @param {string} feedback - Feedback for the student.
 * @returns {Promise<Object|undefined>} The updated submission object.
 */
export const gradeSubmission = async (submissionId, grade, feedback) => {
  const query = `
    UPDATE submissions 
    SET grade = $1, feedback = $2 
    WHERE id = $3 
    RETURNING id, student_id, assignment_id, submission_file_url, grade, feedback, submitted_at
  `
  const { rows } = await pool.query(query, [grade, feedback, submissionId])
  return rows[0]
}

/**
 * Deletes a submission from the database.
 * @param {number} submissionId - The ID of the submission to delete.
 * @returns {Promise<Object|undefined>} The deleted submission object.
 */
export const deleteSubmission = async (submissionId) => {
  const query = `
    DELETE FROM submissions 
    WHERE id = $1 
    RETURNING id, student_id, assignment_id, submission_file_url, grade, feedback, submitted_at
  `
  const { rows } = await pool.query(query, [submissionId])
  return rows[0]
}

/**
 * Gets submissions for courses taught by a specific instructor.
 * @param {number} instructorId - The ID of the instructor.
 * @returns {Promise<Array>} Array of submissions for the instructor's courses.
 */
export const getInstructorSubmissions = async (instructorId) => {
  const query = `
    SELECT s.*, u.name as student_name, u.email as student_email,
           a.title as assignment_title, c.title as course_title
    FROM submissions s
    JOIN users u ON s.student_id = u.id
    JOIN assignments a ON s.assignment_id = a.id
    JOIN courses c ON a.course_id = c.id
    WHERE c.instructor_id = $1
    ORDER BY s.submitted_at DESC
  `
  const { rows } = await pool.query(query, [instructorId])
  return rows
}

/**
 * Gets all submissions (admin only).
 * @returns {Promise<Array>} Array of all submissions.
 */
export const getAllSubmissions = async () => {
  const query = `
    SELECT s.*, u.name as student_name, u.email as student_email,
           a.title as assignment_title, c.title as course_title,
           i.name as instructor_name
    FROM submissions s
    JOIN users u ON s.student_id = u.id
    JOIN assignments a ON s.assignment_id = a.id
    JOIN courses c ON a.course_id = c.id
    JOIN users i ON c.instructor_id = i.id
    ORDER BY s.submitted_at DESC
  `
  const { rows } = await pool.query(query)
  return rows
}
