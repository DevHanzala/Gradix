import { getStudentAssessmentsService } from "../services/studentAnalytics.service.js";
import { getResultsService } from "../services/learning/results.service.js";
import { getStudyPlanService } from "../services/learning/studyPlan.service.js";
import { getReportPdfService } from "../services/learning/report.service.js";
import { createPracticeService, checkPracticeAnswerService } from "../services/learning/practice.service.js";
import { getUserById } from "../models/userModel.js";

// Errors (AppError with code/status, or unexpected ones) go to the error middleware.

/** The signed-in student with their language preference (the JWT does not carry it). */
const currentStudent = async (req) => {
  const user = await getUserById(req.user.id);
  return { id: req.user.id, language_preference: user?.language_preference || "en" };
};

const handle = (fn) => async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await fn(req) });
  } catch (error) {
    next(error);
  }
};

export const getStudentAssessments = handle(async (req) => (await getStudentAssessmentsService(req.user.id, req.user.role)).data);

export const getResults = handle((req) => getResultsService(req.user.id, req.params.assessmentId));

export const getStudyPlan = handle(async (req) =>
  getStudyPlanService(await currentStudent(req), req.params.assessmentId, {
    language: req.body?.language || req.query.language,
    refresh: Boolean(req.body?.refresh),
  })
);

export const createPractice = handle(async (req) =>
  createPracticeService(await currentStudent(req), req.params.assessmentId, { language: req.body?.language, count: req.body?.count })
);

export const checkPracticeAnswer = handle((req) =>
  checkPracticeAnswerService({ id: req.user.id }, req.params.sessionId, req.body?.index, req.body?.answer)
);

export const downloadReport = async (req, res, next) => {
  try {
    const { pdf, language } = await getReportPdfService(await currentStudent(req), req.params.assessmentId, {
      language: req.query.language,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="gradix-report-${req.params.assessmentId}-${language}.pdf"`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
};
