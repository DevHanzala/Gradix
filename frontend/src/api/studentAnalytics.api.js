import apiClient from "../lib/apiClient.js";

export const fetchAssessmentsAPI = () => apiClient.get("/student-analytics/assessments");

/* Learning pathways (completed attempts only) */

export const fetchResultsAPI = (assessmentId) => apiClient.get(`/student-analytics/results/${assessmentId}`);

export const fetchStudyPlanAPI = (assessmentId, { language, refresh = false } = {}) =>
  apiClient.post(`/student-analytics/results/${assessmentId}/study-plan`, { language, refresh });

export const downloadReportAPI = (assessmentId, language) =>
  apiClient.get(`/student-analytics/results/${assessmentId}/report.pdf`, { params: { language }, responseType: "blob" });

export const createPracticeAPI = (assessmentId, { language, count } = {}) =>
  apiClient.post(`/student-analytics/results/${assessmentId}/practice`, { language, count });

export const checkPracticeAnswerAPI = (sessionId, index, answer) =>
  apiClient.post(`/student-analytics/practice/${sessionId}/check`, { index, answer });
