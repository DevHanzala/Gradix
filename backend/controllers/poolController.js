import {
  listQuestionsService,
  poolStatusService,
  publishService,
  retryPublishService,
  addQuestionService,
  editQuestionService,
  retireQuestionService,
  approveQuestionService,
  regenerateQuestionService,
} from "../services/pool/bank.service.js";

const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    res.status(status).json({ success: true, data: await fn(req) });
  } catch (error) {
    next(error);
  }
};

export const listQuestions = handle((req) => listQuestionsService(req.params.id, req.user, req.query));
export const getPoolStatus = handle((req) => poolStatusService(req.params.id, req.user));
export const publish = handle((req) => publishService(req.params.id, req.user, req.body?.languages), 202);
export const retryPublish = handle((req) => retryPublishService(req.params.id, req.user), 202);
export const addQuestion = handle((req) => addQuestionService(req.params.id, req.user, req.body), 201);
export const editQuestion = handle((req) => editQuestionService(req.params.id, req.params.questionId, req.user, req.body));
export const retireQuestion = handle((req) => retireQuestionService(req.params.id, req.params.questionId, req.user));
export const approveQuestion = handle((req) => approveQuestionService(req.params.id, req.params.questionId, req.user));
export const regenerateQuestion = handle((req) => regenerateQuestionService(req.params.id, req.params.questionId, req.user));
