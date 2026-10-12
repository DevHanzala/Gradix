import {
  getAttemptStateService,
  startAssessmentForStudentService,
  saveAnswerService,
  advanceQuestionService,
  submitAssessmentForStudentService,
  getSubmissionDetailsForStudentService,
} from "../services/studentAssessment.service.js";

// AppErrors (with code/status) are rendered by the error middleware.

// GET /api/taking/assessments/:assessmentId/attempt
export const getAttemptState = async (req, res, next) => {
  try {
    const data = await getAttemptStateService(req.user.id, req.params.assessmentId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// POST /api/taking/assessments/:assessmentId/start
export const startAssessmentForStudent = async (req, res, next) => {
  try {
    const { language = "en" } = req.body || {};
    const data = await startAssessmentForStudentService(req.user.id, req.params.assessmentId, language);
    res.status(200).json({
      success: true,
      code: data.resumed ? "IN_PROGRESS" : "STARTED",
      message: data.resumed ? "Resumed your assessment" : "Assessment started",
      data,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/taking/attempts/:attemptId/answers/:questionId
export const saveAnswer = async (req, res, next) => {
  try {
    const { answer = null } = req.body || {};
    const data = await saveAnswerService(req.user.id, req.params.attemptId, req.params.questionId, answer);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// POST /api/taking/attempts/:attemptId/advance
export const advanceQuestion = async (req, res, next) => {
  try {
    const { fromIndex } = req.body || {};
    const data = await advanceQuestionService(req.user.id, req.params.attemptId, fromIndex);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// POST /api/taking/assessments/:assessmentId/submit
export const submitAssessmentForStudent = async (req, res, next) => {
  try {
    const { attemptId, answers } = req.body || {};
    const data = await submitAssessmentForStudentService(req.user.id, req.params.assessmentId, attemptId, answers);
    res.status(200).json({ success: true, message: "Assessment submitted successfully", data });
  } catch (error) {
    next(error);
  }
};

// GET /api/taking/submissions/:submissionId
export const getSubmissionDetailsForStudent = async (req, res, next) => {
  try {
    const data = await getSubmissionDetailsForStudentService(req.user.id, req.params.submissionId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
