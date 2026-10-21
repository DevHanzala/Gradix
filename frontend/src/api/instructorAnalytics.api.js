import apiClient from "../lib/apiClient.js";

export const fetchInstructorAssessmentsAPI = () =>
  apiClient.get("/instructor-analytics/assessments");

export const fetchAssessmentStudentsAPI = (assessmentId) =>
  apiClient.get(`/instructor-analytics/assessment/${assessmentId}/students`);

export const fetchStudentQuestionsAPI = (assessmentId, studentId) =>
  apiClient.get(
    `/instructor-analytics/assessment/${assessmentId}/student/${studentId}/questions`
  );
  
export const fetchInstructorOverviewAPI = () =>
  apiClient.get("/instructor-analytics");

/* Insights: objective accuracy, hardest objectives, distribution, difficulty reached */
export const fetchInsightsAPI = (assessmentId) => apiClient.get(`/instructor-analytics/assessment/${assessmentId}/insights`);

export const exportResultsAPI = (assessmentId, format = "csv") =>
  apiClient.get(`/instructor-analytics/assessment/${assessmentId}/export`, { params: { format }, responseType: "blob" });
