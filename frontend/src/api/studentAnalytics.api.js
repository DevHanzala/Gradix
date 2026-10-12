import apiClient from "../lib/apiClient.js";

export const fetchAssessmentsAPI = () =>
  apiClient.get("/student-analytics/assessments");

export const fetchAssessmentDetailsAPI = (id) =>
  apiClient.get(`/student-analytics/assessment/${id}`);

export const fetchReportAPI = (assessmentId) =>
  apiClient.get(`/student-analytics/report?assessmentId=${assessmentId}&format=json`);

export const fetchAssessmentQuestionsAPI = (assessmentId) =>
  apiClient.get(`/student-analytics/assessment/${assessmentId}/questions`);
