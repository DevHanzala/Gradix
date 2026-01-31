import apiClient from "../lib/apiClient.js";

export const fetchOverviewAPI = () =>
  apiClient.get("/student-analytics/overview");

export const fetchPerformanceAPI = (timeRange) =>
  apiClient.get(`/student-analytics/performance?timeRange=${timeRange}`);

export const fetchRecommendationsAPI = () =>
  apiClient.get("/student-analytics/recommendations");

export const fetchAssessmentsAPI = () =>
  apiClient.get("/student-analytics/assessments");

export const fetchAssessmentDetailsAPI = (id) =>
  apiClient.get(`/student-analytics/assessment/${id}`);

export const fetchReportAPI = (assessmentId) =>
  apiClient.get(
    `/student-analytics/report?assessmentId=${assessmentId}&format=json`
  );

export const fetchAssessmentQuestionsAPI = (assessmentId) =>
  apiClient.get(`/student-analytics/assessment/${assessmentId}/questions`);
