import apiClient from "../lib/apiClient";

/* =========================
   Assessment taking
========================= */

export const getAttemptStateApi = (assessmentId) =>
  apiClient.get(`/taking/assessments/${assessmentId}/attempt`);

export const startAssessmentApi = (assessmentId, payload) =>
  apiClient.post(`/taking/assessments/${assessmentId}/start`, payload);

export const saveAnswerApi = (attemptId, questionId, answer) =>
  apiClient.put(`/taking/attempts/${attemptId}/answers/${questionId}`, { answer });

export const advanceQuestionApi = (attemptId, fromIndex) =>
  apiClient.post(`/taking/attempts/${attemptId}/advance`, { fromIndex });

export const submitAssessmentApi = (assessmentId, payload) =>
  apiClient.post(`/taking/assessments/${assessmentId}/submit`, payload);

export const getSubmissionDetailsApi = (submissionId) =>
  apiClient.get(`/taking/submissions/${submissionId}`);
