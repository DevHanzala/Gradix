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
