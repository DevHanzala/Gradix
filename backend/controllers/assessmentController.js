import {
  createAssessment,
  storeQuestionBlocks,
  getAssessmentsByInstructor,
  getAssessmentById,
  updateAssessment,
  deleteAssessment,
  enrollStudent,
  unenrollStudent,
  getEnrolledStudents,
  generateAssessmentQuestions,
} from '../models/assessmentModel.js';
import { findUserByEmail } from '../models/userModel.js';
import { linkResourceToAssessment } from '../models/resourceModel.js';
import { uploadResource } from './resourceController.js';
import { sendAssessmentEnrollmentEmail } from '../services/emailService.js';
import pool from '../DB/db.js';

export const createNewAssessment = async (req, res) => {
  try {
    const {
      title,
      prompt,
      externalLinks,
      question_blocks,
      selected_resources = [],
    } = req.body;
    const instructor_id = req.user.id;
    const new_files = req.files?.new_files || [];

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required and must be a non-empty string',
      });
    }

    if (title && (!title || typeof title !== 'string' || !title.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Title must be a non-empty string if provided',
      });
    }

    // Validate question_blocks if provided
    if (question_blocks && Array.isArray(question_blocks) && question_blocks.length > 0) {
      for (const block of question_blocks) {
        if (!block.question_count || block.question_count < 1) {
          return res.status(400).json({
            success: false,
            message: 'Question count must be at least 1 for each block',
          });
        }
        if (!block.duration_per_question || block.duration_per_question < 30) {
          return res.status(400).json({
            success: false,
            message: 'Duration per question must be at least 30 seconds',
          });
        }
        if (block.question_type === 'multiple_choice' && (!block.num_options || block.num_options < 2)) {
          return res.status(400).json({
            success: false,
            message: 'Multiple choice questions must have at least 2 options',
          });
        }
      }
    }

    const assessmentData = {
      title: title || null,
      prompt: prompt.trim(),
      external_links: externalLinks && Array.isArray(externalLinks) ? externalLinks.filter(link => link && link.trim()) : null,
      instructor_id,
      is_executed: false,
    };

    console.log('📝 Creating assessment with data:', assessmentData);

    const newAssessment = await createAssessment(assessmentData);

    if (question_blocks && Array.isArray(question_blocks) && question_blocks.length > 0) {
      await storeQuestionBlocks(newAssessment.id, question_blocks, instructor_id);
    }

    let newResourceIds = [];
    if (new_files.length > 0) {
      const uploadedResources = await uploadResource({ files: new_files });
      newResourceIds = uploadedResources.map(r => r.id);
    }

    const allResources = [...selected_resources, ...newResourceIds];
    for (const resourceId of allResources) {
      await linkResourceToAssessment(newAssessment.id, resourceId);
    }

    res.status(201).json({
      success: true,
      message: 'Assessment created successfully',
      data: newAssessment,
    });
  } catch (error) {
    console.error('❌ Create assessment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create assessment',
      error: error.message,
    });
  }
};

export const getInstructorAssessments = async (req, res) => {
  try {
    const instructor_id = req.user.id;
    console.log(`🔄 Fetching assessments for instructor ${instructor_id}`);
    const assessments = await getAssessmentsByInstructor(instructor_id);
    res.status(200).json({
      success: true,
      message: 'Assessments retrieved successfully',
      data: assessments,
    });
  } catch (error) {
    console.error('❌ Get assessments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve assessments',
      error: error.message,
    });
  }
};

export const getAssessment = async (req, res) => {
  try {
    const assessment_id = req.params.id;
    const user_id = req.user.id;
    const user_role = req.user.role;

    if (!assessment_id || isNaN(parseInt(assessment_id))) {
      return res.status(400).json({ success: false, message: 'Invalid assessment ID' });
    }

    console.log(`🔄 Fetching assessment ${assessment_id} for user ${user_id} (${user_role})`);

    const assessment = await getAssessmentById(parseInt(assessment_id), user_id, user_role);

    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found or access denied' });
    }

    res.status(200).json({
      success: true,
      message: 'Assessment retrieved successfully',
      data: assessment,
    });
  } catch (error) {
    console.error('❌ Get assessment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve assessment',
      error: error.message,
    });
  }
};

export const updateAssessmentData = async (req, res) => {
  try {
    const assessment_id = req.params.id;
    const user_id = req.user.id;
    const user_role = req.user.role;
    const { title, prompt, externalLinks, question_blocks, selected_resources = [] } = req.body;
    const new_files = req.files?.new_files || [];

    if (!assessment_id || isNaN(parseInt(assessment_id))) {
      return res.status(400).json({ success: false, message: 'Invalid assessment ID' });
    }

    console.log(`🔄 Updating assessment ${assessment_id} for user ${user_id} (${user_role})`);

    const assessment = await getAssessmentById(parseInt(assessment_id), user_id, user_role);

    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found or access denied' });
    }

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ success: false, message: 'Prompt is required and must be a non-empty string' });
    }

    if (title && (!title || typeof title !== 'string' || !title.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Title must be a non-empty string if provided',
      });
    }

    // Validate question_blocks if provided
    if (question_blocks && Array.isArray(question_blocks) && question_blocks.length > 0) {
      for (const block of question_blocks) {
        if (!block.question_count || block.question_count < 1) {
          return res.status(400).json({
            success: false,
            message: 'Question count must be at least 1 for each block',
          });
        }
        if (!block.duration_per_question || block.duration_per_question < 30) {
          return res.status(400).json({
            success: false,
            message: 'Duration per question must be at least 30 seconds',
          });
        }
        if (block.question_type === 'multiple_choice' && (!block.num_options || block.num_options < 2)) {
          return res.status(400).json({
            success: false,
            message: 'Multiple choice questions must have at least 2 options',
          });
        }
      }
    }

    const updateData = {
      title: title || null,
      prompt: prompt.trim(),
      external_links: externalLinks && Array.isArray(externalLinks) ? externalLinks.filter(link => link && link.trim()) : null,
    };

    const updatedAssessment = await updateAssessment(parseInt(assessment_id), updateData);

    if (question_blocks && Array.isArray(question_blocks) && question_blocks.length > 0) {
      await storeQuestionBlocks(parseInt(assessment_id), question_blocks, user_id);
    }

    let newResourceIds = [];
    if (new_files.length > 0) {
      const uploadedResources = await uploadResource({ files: new_files });
      newResourceIds = uploadedResources.map(r => r.id);
    }

    const allResources = [...selected_resources, ...newResourceIds];
    await pool.query('DELETE FROM assessment_resources WHERE assessment_id = $1', [parseInt(assessment_id)]);
    for (const resourceId of allResources) {
      await linkResourceToAssessment(parseInt(assessment_id), resourceId);
    }

    res.status(200).json({
      success: true,
      message: 'Assessment updated successfully',
      data: updatedAssessment,
    });
  } catch (error) {
    console.error('❌ Update assessment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update assessment',
      error: error.message,
    });
  }
};

export const deleteAssessmentData = async (req, res) => {
  try {
    const assessment_id = req.params.id;
    const user_id = req.user.id;
    const user_role = req.user.role;

    if (!assessment_id || isNaN(parseInt(assessment_id))) {
      return res.status(400).json({ success: false, message: 'Invalid assessment ID' });
    }

    console.log(`🔄 Deleting assessment ${assessment_id} for user ${user_id} (${user_role})`);

    const assessment = await getAssessmentById(parseInt(assessment_id), user_id, user_role);
    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found or access denied' });
    }

    await deleteAssessment(parseInt(assessment_id));
    console.log(`✅ Assessment deleted: ID=${assessment_id}`);
    res.status(200).json({
      success: true,
      message: 'Assessment deleted successfully',
    });
  } catch (error) {
    console.error('❌ Delete assessment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete assessment',
      error: error.message,
    });
  }
};

export const enrollStudentController = async (req, res) => {
  try {
    const assessmentId = req.params.id;
    const { email } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log(`🔍 Validating enrollment for assessment ${assessmentId}, email: ${email}, user: ${userId} (${userRole})`);

    if (!assessmentId || isNaN(parseInt(assessmentId))) {
      console.warn(`⚠️ Invalid assessment ID: ${assessmentId}`);
      return res.status(400).json({ success: false, message: 'Invalid assessment ID' });
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      console.warn(`⚠️ Invalid email: ${email}`);
      return res.status(400).json({ success: false, message: 'Student email is required and must be a valid string' });
    }

    console.log(`🔄 Checking assessment ${assessmentId} for user ${userId} (${userRole})`);
    const assessment = await getAssessmentById(parseInt(assessmentId), userId, userRole);
    if (!assessment) {
      console.warn(`⚠️ Assessment ${assessmentId} not found or access denied for user ${userId}`);
      return res.status(404).json({ success: false, message: 'Assessment not found or access denied' });
    }

    console.log(`🔍 Looking up student by email: ${email}`);
    const student = await findUserByEmail(email);
    if (!student) {
      console.warn(`⚠️ Student not found: ${email}`);
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    if (student.role !== 'student') {
      console.warn(`⚠️ User ${email} is not a student, role: ${student.role}`);
      return res.status(400).json({ success: false, message: `User is not a student (role: ${student.role})` });
    }

    console.log(`🔄 Enrolling student ${student.id} to assessment ${assessmentId}`);
    const enrollment = await enrollStudent(parseInt(assessmentId), email);

    console.log(`🔄 Sending enrollment email to ${email} for assessment ${assessmentId}`);
    await sendAssessmentEnrollmentEmail(email, assessment.title, assessmentId);

    console.log(`✅ Student enrolled successfully for assessment ${assessmentId}`);
    res.status(200).json({
      success: true,
      message: 'Student enrolled successfully',
      data: enrollment,
    });
  } catch (error) {
    console.error('❌ Error enrolling student:', error.message, error.stack);
    if (error.message === 'Student already enrolled') {
      return res.status(409).json({ success: false, message: 'Student is already enrolled in this assessment' });
    }
    res.status(500).json({ success: false, message: error.message || 'Failed to enroll student' });
  }
};

export const unenrollStudentController = async (req, res) => {
  try {
    const assessmentId = req.params.id;
    const studentId = req.params.studentId;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!assessmentId || isNaN(parseInt(assessmentId))) {
      return res.status(400).json({ success: false, message: 'Invalid assessment ID' });
    }

    if (!studentId || isNaN(parseInt(studentId))) {
      return res.status(400).json({ success: false, message: 'Invalid student ID' });
    }

    console.log(`🔄 Unenrolling student ${studentId} from assessment ${assessmentId} by user ${userId} (${userRole})`);

    const assessment = await getAssessmentById(parseInt(assessmentId), userId, userRole);
    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found or access denied' });
    }

    const result = await unenrollStudent(parseInt(assessmentId), parseInt(studentId));

    res.status(200).json({
      success: true,
      message: 'Student unenrolled successfully',
      data: result,
    });
  } catch (error) {
    console.error('❌ Unenroll student error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unenroll student',
      error: error.message,
    });
  }
};

export const getEnrolledStudentsController = async (req, res) => {
  try {
    const assessmentId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!assessmentId || isNaN(parseInt(assessmentId))) {
      return res.status(400).json({ success: false, message: 'Invalid assessment ID' });
    }

    console.log(`🔄 Fetching enrolled students for assessment ${assessmentId} by user ${userId} (${userRole})`);

    const assessment = await getAssessmentById(parseInt(assessmentId), userId, userRole);
    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found or access denied' });
    }

    const students = await getEnrolledStudents(parseInt(assessmentId));

    res.status(200).json({
      success: true,
      message: 'Enrolled students retrieved successfully',
      data: students,
    });
  } catch (error) {
    console.error('❌ Get enrolled students error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve enrolled students',
      error: error.message,
    });
  }
};

export const startAssessmentForStudent = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { language } = req.body;
    const studentId = req.user.id;

    if (!assessmentId || isNaN(parseInt(assessmentId))) {
      return res.status(400).json({ success: false, message: 'Invalid assessment ID' });
    }

    console.log(`🔄 Starting assessment ${assessmentId} for student ${studentId}`);

    const assessment = await getAssessmentById(parseInt(assessmentId), studentId, 'student');
    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found or access denied' });
    }

    const { rows: enrollRows } = await pool.query(
      `SELECT * FROM enrollments WHERE assessment_id = $1 AND student_id = $2`,
      [assessmentId, studentId]
    );
    if (enrollRows.length === 0) {
      console.warn(`⚠️ Student ${studentId} not enrolled for assessment ${assessmentId}`);
      return res.status(403).json({ success: false, message: 'You are not enrolled for this assessment' });
    }

    const { rows: existingAttempt } = await pool.query(
      `SELECT id FROM assessment_attempts WHERE student_id = $1 AND assessment_id = $2 AND status = 'in_progress'`,
      [studentId, assessmentId]
    );
    if (existingAttempt.length > 0) {
      console.warn(`⚠️ In-progress attempt exists for student ${studentId}, assessment ${assessmentId}`);
      return res.status(400).json({ success: false, message: 'Assessment already in progress' });
    }

    const { rows: attemptRows } = await pool.query(
      `INSERT INTO assessment_attempts (student_id, assessment_id, attempt_number, started_at, language, status)
       VALUES ($1, $2, (SELECT COALESCE(MAX(attempt_number), 0) + 1 FROM assessment_attempts WHERE student_id = $1 AND assessment_id = $2), NOW(), $3, 'in_progress') RETURNING id`,
      [studentId, assessmentId, language]
    );
    const attemptId = attemptRows[0].id;
    console.log(`✅ Created attempt ${attemptId} for assessment ${assessmentId}`);

    const { questions, duration } = await generateAssessmentQuestions(assessmentId, attemptId, language, assessment);

    const { rows: dbQuestions } = await pool.query(
      `SELECT id, question_order, question_type, question_text, options, correct_answer, positive_marks, negative_marks, duration_per_question
       FROM generated_questions WHERE attempt_id = $1 ORDER BY question_order ASC`,
      [attemptId]
    );

    console.log(`✅ Generated ${dbQuestions.length} questions for attempt ${attemptId}`);

    res.status(200).json({
      success: true,
      message: 'Assessment started successfully',
      data: { attemptId, duration, questions: dbQuestions },
    });
  } catch (error) {
    console.error('❌ startAssessmentForStudent error:', error.message, error.stack);
    res.status(500).json({ success: false, message: 'Failed to start assessment' });
  }
};