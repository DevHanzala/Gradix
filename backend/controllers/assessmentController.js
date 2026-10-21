import {
  createAssessmentService,
  getInstructorAssessmentsService,
  getAssessmentService,
  updateAssessmentService,
  deleteAssessmentService,
  enrollStudentService,
  unenrollStudentService,
  getEnrolledStudentsService,
  previewQuestionsService,
  generatePhysicalPaperService,
  enrollGroupService,
} from "../services/assessment.service.js";

// Errors (AppError with code/status, or unexpected ones) go to the error middleware.

export const createAssessment = async (req, res, next) => {
  try {
    const assessment = await createAssessmentService(req.body, req.user, req.files || []);
    res.status(201).json({ success: true, message: "Assessment created successfully", data: assessment });
  } catch (error) {
    next(error);
  }
};

export const getInstructorAssessments = async (req, res, next) => {
  try {
    const { data } = await getInstructorAssessmentsService(req.user.id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getAssessment = async (req, res, next) => {
  try {
    const { data } = await getAssessmentService(req.params.id, req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const updateAssessmentData = async (req, res, next) => {
  try {
    const updated = await updateAssessmentService(req.params.id, req.body, req.user, req.files || []);
    res.status(200).json({ success: true, message: "Assessment updated successfully", data: updated });
  } catch (error) {
    next(error);
  }
};

export const deleteAssessmentData = async (req, res, next) => {
  try {
    await deleteAssessmentService(req.params.id, req.user);
    res.status(200).json({ success: true, message: "Assessment deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const enrollStudentController = async (req, res, next) => {
  try {
    const { enrollment, student } = await enrollStudentService(req.params.id, req.body?.email, req.user);
    res.status(200).json({ success: true, message: "Student enrolled successfully", data: { ...enrollment, ...student } });
  } catch (error) {
    next(error);
  }
};

export const unenrollStudentController = async (req, res, next) => {
  try {
    const result = await unenrollStudentService(req.params.id, req.params.studentId, req.user);
    res.status(200).json({ success: true, message: "Student unenrolled successfully", data: result });
  } catch (error) {
    next(error);
  }
};

export const getEnrolledStudentsController = async (req, res, next) => {
  try {
    const students = await getEnrolledStudentsService(req.params.id, req.user);
    res.status(200).json({ success: true, data: students });
  } catch (error) {
    next(error);
  }
};

export const previewQuestions = async (req, res, next) => {
  try {
    const questions = await previewQuestionsService(req.params.id, req.user);
    res.json({ success: true, questions });
  } catch (error) {
    next(error);
  }
};

const PAGE_SIZES = ["A4", "A5", "Letter", "Legal"];
const clampFont = (value, fallback, min, max) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export const generatePhysicalPaper = async (req, res, next) => {
  try {
    const body = req.body || {};
    const paperData = {
      language: body.language || "en",
      instituteName: String(body.instituteName || "").slice(0, 200),
      teacherName: String(body.teacherName || "").slice(0, 200),
      subjectName: String(body.subjectName || "").slice(0, 200),
      paperDate: String(body.paperDate || "").slice(0, 50),
      paperTime: String(body.paperTime || "").slice(0, 50),
      notes: String(body.notes || "").slice(0, 2000),
      mode: body.mode === "unique" ? "unique" : "same",
      copies: body.copies,
      format: body.format === "docx" ? "docx" : "pdf",
    };
    const formOptions = {
      pageSize: PAGE_SIZES.includes(body.pageSize) ? body.pageSize : "A4",
      headerFontSize: clampFont(body.headerFontSize, 18, 10, 36),
      questionFontSize: clampFont(body.questionFontSize, 10, 8, 20),
      optionFontSize: clampFont(body.optionFontSize, 9, 7, 18),
    };

    const { buffer, format } = await generatePhysicalPaperService(req.params.id, req.user, { ...paperData, form: formOptions });
    const docx = format === "docx";
    res.setHeader(
      "Content-Type",
      docx ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf"
    );
    res.setHeader("Content-Disposition", `attachment; filename="Paper_${paperData.language.toUpperCase()}.${format}"`);
    res.setHeader("Content-Length", buffer.length);
    res.end(buffer);
  } catch (error) {
    next(error);
  }
};

export const enrollGroupController = async (req, res, next) => {
  try {
    const data = await enrollGroupService(req.params.id, req.body?.groupId, req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
