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
  apiClient.post(`/taking/assessments/${assessmentId}/print`, payload, config);


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
   Student Side
========================= */

export const fetchStudentAssessmentsApi = () =>
  apiClient.get("/taking/assessments");

/* =========================
   Preview / AI
========================= */

export const fetchPreviewQuestionsApi = (assessmentId) =>
  apiClient.get(`/assessments/${assessmentId}/preview-questions`);
