import apiClient from "../lib/apiClient";

/* =========================
   Instructor / Assessment
========================= */

export const fetchInstructorAssessments = () =>
  apiClient.get("/assessments");

export const fetchAssessmentById = (assessmentId) =>
  apiClient.get(`/assessments/${assessmentId}`);

export const createAssessmentApi = (formData) =>
  apiClient.post("/assessments", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const updateAssessmentApi = (assessmentId, formData) =>
  apiClient.put(`/assessments/${assessmentId}`, formData);

export const deleteAssessmentApi = (assessmentId) =>
  apiClient.delete(`/assessments/${assessmentId}`);

/* =========================
   Physical Paper
========================= */
export const generatePhysicalPaperApi = (assessmentId, payload, config = {}) =>
  apiClient.post(`/assessments/${assessmentId}/print`, payload, config);



/* =========================
   Enrollment
========================= */

export const fetchEnrolledStudentsApi = (assessmentId) =>
  apiClient.get(`/assessments/${assessmentId}/enrolled-students`);

export const enrollStudentApi = (assessmentId, email) =>
  apiClient.post(`/assessments/${assessmentId}/enroll`, { email });

export const unenrollStudentApi = (assessmentId, studentId) =>
  apiClient.delete(
    `/assessments/${assessmentId}/enroll/${studentId}`
  );

/* =========================
   Preview / AI
========================= */

export const fetchPreviewQuestionsApi = (assessmentId) =>
  apiClient.get(`/assessments/${assessmentId}/preview-questions`);

/* =========================
   Learning objectives
========================= */

export const fetchObjectivesApi = (assessmentId) =>
  apiClient.get(`/assessments/${assessmentId}/objectives`);

export const saveObjectivesApi = (assessmentId, objectives) =>
  apiClient.put(`/assessments/${assessmentId}/objectives`, { objectives });

export const regenerateObjectivesApi = (assessmentId) =>
  apiClient.post(`/assessments/${assessmentId}/objectives/regenerate`);

/* =========================
   Publishing + question bank
========================= */

export const publishAssessmentApi = (assessmentId, languages) =>
  apiClient.post(`/assessments/${assessmentId}/publish`, { languages });

export const retryPublishApi = (assessmentId) =>
  apiClient.post(`/assessments/${assessmentId}/publish/retry`);

export const fetchPoolStatusApi = (assessmentId) =>
  apiClient.get(`/assessments/${assessmentId}/pool/status`);

export const fetchBankQuestionsApi = (assessmentId, params) =>
  apiClient.get(`/assessments/${assessmentId}/questions`, { params });

export const addBankQuestionApi = (assessmentId, question) =>
  apiClient.post(`/assessments/${assessmentId}/questions`, question);

export const editBankQuestionApi = (assessmentId, questionId, question) =>
  apiClient.put(`/assessments/${assessmentId}/questions/${questionId}`, question);

export const retireBankQuestionApi = (assessmentId, questionId) =>
  apiClient.delete(`/assessments/${assessmentId}/questions/${questionId}`);

export const approveBankQuestionApi = (assessmentId, questionId) =>
  apiClient.post(`/assessments/${assessmentId}/questions/${questionId}/approve`);

export const regenerateBankQuestionApi = (assessmentId, questionId) =>
  apiClient.post(`/assessments/${assessmentId}/questions/${questionId}/regenerate`);
