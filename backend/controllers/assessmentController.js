import {
  createAssessmentBasicService,
  createNewAssessmentService,
  getInstructorAssessmentsService,
  getAssessmentService,
  updateAssessmentService,
  deleteAssessmentService,
  enrollStudentService,
  unenrollStudentService,
  getEnrolledStudentsService,
  previewQuestionsService,
  generatePhysicalPaperService,
} from '../services/assessment.service.js';

// ==================== CONTROLLER FUNCTIONS ====================

// 1. CREATE ASSESSMENT BASIC
export const createAssessmentBasic = async (req, res) => {
  try {
    // ✅ NORMALIZE FormData JSON fields FIRST
    const parseIfString = (v) => {
      if (typeof v === "string") {
        try { return JSON.parse(v); } catch { return v; }
      }
      return v;
    };

    req.body.external_links = parseIfString(req.body.external_links);
    req.body.selected_resources = parseIfString(req.body.selected_resources);
    req.body.question_blocks = parseIfString(req.body.question_blocks);

    const assessment = await createAssessmentBasicService(
      req.body,
      req.user.id,
      req.files
    )

    res.status(201).json({ success: true, data: assessment });
    console.log('Assessment created successfully');
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. CREATE NEW ASSESSMENT  //hold this function for future use
export const createNewAssessment = async (req, res) => {
  try {
    const newAssessment = await createNewAssessmentService(req.body, req.user.id, req.files);

    res.status(201).json({
      success: true,
      message: 'Assessment created successfully',
      data: newAssessment,
    });
  } catch (error) {
    console.error('Create assessment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create assessment',
    });
  }
};

// 3. GET ASSESSMENTS FOR INSTRUCTOR 
export const getInstructorAssessments = async (req, res) => {
  try {
    const { data } = await getInstructorAssessmentsService(req.user.id);

    res.status(200).json({
      success: true,
      message: 'Assessments retrieved successfully',
      data,
    });
  } catch (error) {
    console.error('Get assessments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve assessments',
    });
  }
};

// 4. GET SINGLE ASSESSMENT
export const getAssessment = async (req, res) => {
  try {
    const assessment_id = parseInt(req.params.id);
    const { data } = await getAssessmentService(assessment_id, req.user.id, req.user.role);

    res.status(200).json({
      success: true,
      message: 'Assessment retrieved successfully',
      data,
    });
  } catch (error) {
    console.error('Get assessment error:', error);
    
    if (error.message === 'Invalid assessment ID') {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message === 'Assessment not found or access denied') {
      return res.status(404).json({ success: false, message: error.message });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve assessment',
    });
  }
};

// 5. UPDATE ASSESSMENT DATA
export const updateAssessmentData = async (req, res) => {
  try {
    const assessment_id = req.params.id;
    
    const updateData = {
      title: req.body.title,
      prompt: req.body.prompt,
      externalLinks: req.body.externalLinks ? JSON.parse(req.body.externalLinks) : [],
      question_blocks: req.body.question_blocks ? JSON.parse(req.body.question_blocks) : [],
      selected_resources: req.body.selected_resources ? JSON.parse(req.body.selected_resources) : [],
    };

    const updatedAssessment = await updateAssessmentService(
      assessment_id,
      updateData,
      req.user.id,
      req.files
    );

    res.status(200).json({
      success: true,
      message: 'Assessment updated successfully',
      data: updatedAssessment,
    });
  } catch (error) {
    console.error('Update assessment error:', error);
    
    if (error.message.includes('required') || error.message.includes('must provide')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Server error' 
    });
  }
};

// 6. DELETE ASSESSMENT DATA
export const deleteAssessmentData = async (req, res) => {
  try {
    const assessment_id = req.params.id;
    
    await deleteAssessmentService(parseInt(assessment_id), req.user.id, req.user.role);

    res.status(200).json({
      success: true,
      message: 'Assessment deleted successfully',
    });
  } catch (error) {
    console.error('❌ Delete assessment error:', error);
    
    if (error.message === 'Invalid assessment ID') {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message === 'Assessment not found or access denied') {
      return res.status(404).json({ success: false, message: error.message });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to delete assessment',
      error: error.message,
    });
  }
};

// 7. ENROLL STUDENT TO ASSESSMENT
export const enrollStudentController = async (req, res) => {
  try {
    const assessmentId = req.params.id;
    const { email } = req.body;
    console.log("Assessment ID enroll calling", assessmentId)

    const { enrollment } = await enrollStudentService(
      assessmentId,
      email,
      req.user.id,
      req.user.role
    );

    res.status(200).json({
      success: true,
      message: 'Student enrolled successfully',
      data: enrollment,
    });
  } catch (error) {
    console.error('❌ Error enrolling student:', error.message, error.stack);
    
    if (error.message === 'Student already enrolled') {
      return res.status(409).json({ 
        success: false, 
        message: 'Student is already enrolled in this assessment' 
      });
    }
    if (error.message === 'Invalid assessment ID' || error.message.includes('required')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to enroll student' 
    });
  }
};

// 8. UNENROLL STUDENT FROM ASSESSMENT
export const unenrollStudentController = async (req, res) => {
  try {
    const assessmentId = req.params.id;
    const studentId = req.params.studentId;

    const result = await unenrollStudentService(
      assessmentId,
      studentId,
      req.user.id,
      req.user.role
    );

    res.status(200).json({
      success: true,
      message: 'Student unenrolled successfully',
      data: result,
    });
  } catch (error) {
    console.error('❌ Unenroll student error:', error);
    
    if (error.message.includes('Invalid')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to unenroll student',
      error: error.message,
    });
  }
};

// 9. GET ENROLLED STUDENTS FOR ASSESSMENT
export const getEnrolledStudentsController = async (req, res) => {
  try {
    const assessmentId = req.params.id;

    const students = await getEnrolledStudentsService(
      assessmentId,
      req.user.id,
      req.user.role
    );

    res.status(200).json({
      success: true,
      message: 'Enrolled students retrieved successfully',
      data: students,
    });
  } catch (error) {
    console.error('❌ Get enrolled students error:', error);
    
    if (error.message === 'Invalid assessment ID') {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve enrolled students',
      error: error.message,
    });
  }
};

// 10. PREVIEW QUESTIONS FOR ASSESSMENT
export const previewQuestions = async (req, res) => {
  try {
    const assessmentId = parseInt(req.params.id);
    const instructorId = req.user.id;

    const questions = await previewQuestionsService(
      assessmentId,
      instructorId,
      req.user.role
    );

    res.json({ 
      success: true, 
      questions 
    });
  } catch (error) {
    console.error('[PREVIEW] ERROR:', error.message);
    
    if (error.message === 'Assessment not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate preview questions' 
    });
  }
};

// 11. GENERATE PHYSICAL PAPER FOR ASSESSMENT
export const generatePhysicalPaper = async (req, res) => {
  try {
    const assessmentId = parseInt(req.params.id);
    const instructorId = req.user.id;
    
    const paperData = {
      language: req.body.language || 'en',
      instituteName: req.body.instituteName || '',
      teacherName: req.body.teacherName || '',
      subjectName: req.body.subjectName || '',
      paperDate: req.body.paperDate || '',
      paperTime: req.body.paperTime || '',
      notes: req.body.notes || '',
    };

    const result = await generatePhysicalPaperService(
      assessmentId,
      instructorId,
      req.user.role,
      paperData
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[PRINT] ERROR:', error);
    
    if (error.message === 'Assessment not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message === 'No questions generated') {
      return res.status(400).json({ success: false, message: error.message });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to prepare paper data' 
    });
  }
};