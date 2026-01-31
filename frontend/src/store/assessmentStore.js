import { create } from "zustand";

import {
  fetchInstructorAssessments,
  fetchAssessmentById,
  createAssessmentApi,
  updateAssessmentApi,
  deleteAssessmentApi,
  fetchEnrolledStudentsApi,
  enrollStudentApi,
  unenrollStudentApi,
  fetchStudentAssessmentsApi,
  fetchPreviewQuestionsApi,
  generatePhysicalPaperApi
} from "../api/assessment.api";

const useAssessmentStore = create((set) => ({
  assessments: [],
  studentAssessments: [],
  currentAssessment: null,
  enrolledStudents: [],
  loading: false,
  error: null,

  /* =========================
     Student
  ========================= */

  getStudentAssessments: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetchStudentAssessmentsApi();
      set({
        studentAssessments: response.data.data || [],
        loading: false,
      });
    } catch (error) {
      const message =
        error.response?.data?.message || "Failed to fetch assessments";
      set({ error: message, loading: false });
      throw error;
    }
  },

  /* =========================
     Instructor
  ========================= */

  getInstructorAssessments: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetchInstructorAssessments();
      set({
        assessments: response.data.data.map((a) => ({
          ...a,
          is_executed: a.is_executed || false,
        })),
        loading: false,
      });
    } catch (error) {
      const message =
        error.response?.data?.message || "Failed to fetch assessments";
      set({ error: message, loading: false });
      throw error;
    }
  },

  getAssessmentById: async (assessmentId) => {
    set({ loading: true, error: null });
    try {
      const response = await fetchAssessmentById(assessmentId);
      set({
        currentAssessment: response.data.data,
        loading: false,
      });
      console.log("Fetched Assessment:", response.data.data.resources);
      return response.data.data;
    } catch (error) {
      const message =
        error.response?.data?.message || "Failed to fetch assessment";
      set({ error: message, loading: false });
      throw error;
    }
  },

  createAssessment: async (formData) => {
    set({ loading: true, error: null });
    try {
      const response = await createAssessmentApi(formData);
      set((state) => ({
        assessments: [{ ...response.data.data, is_executed: false }, ...state.assessments],
        loading: false,
      }));
      return response.data.data;
    } catch (error) {
      const message =
        error.response?.data?.message || "Failed to create assessment";
      set({ error: message, loading: false });
      throw error;
    }
  },

  updateAssessment: async (assessmentId, formData) => {
    set({ loading: true, error: null });
    try {
      const response = await updateAssessmentApi(
        assessmentId,
        formData
      );
      set((state) => ({
        assessments: state.assessments.map((a) =>
          a.id === assessmentId
            ? { ...response.data.data, is_executed: a.is_executed }
            : a
        ),
        currentAssessment: response.data.data,
        loading: false,
      }));
      return response.data.data;
    } catch (error) {
      const message =
        error.response?.data?.message || "Failed to update assessment";
      set({ error: message, loading: false });
      throw error;
    }
  },

  deleteAssessment: async (assessmentId) => {
    set({ loading: true, error: null });
    try {
      await deleteAssessmentApi(assessmentId);
      set((state) => ({
        assessments: state.assessments.filter(
          (a) => a.id !== assessmentId
        ),
        loading: false,
      }));
    } catch (error) {
      const message =
        error.response?.data?.message || "Failed to delete assessment";
      set({ error: message, loading: false });
      throw error;
    }
  },

  /* =========================
   Physical Paper
========================= */

generatePhysicalPaper: async (assessmentId, payload) => {
  set({ loading: true, error: null });
  try {
    const response = await generatePhysicalPaperApi(
      assessmentId,
      payload
    );
    set({ loading: false });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      "Failed to generate physical paper";
    set({ error: message, loading: false });
    throw error;
  }
},


  /* =========================
     Enrollment
  ========================= */

  getEnrolledStudents: async (assessmentId) => {
    set({ loading: true, error: null });
    try {
      const response = await fetchEnrolledStudentsApi(assessmentId);
      set({
        enrolledStudents: response.data.data,
        loading: false,
      });
      return response.data.data;
    } catch (error) {
      const message =
        error.response?.data?.message ||
        "Failed to fetch enrolled students";
      set({ error: message, loading: false });
      throw error;
    }
  },

  enrollStudent: async (assessmentId, email) => {
    set({ loading: true, error: null });
    try {
      const response = await enrollStudentApi(
        assessmentId,
        email
      );
      set((state) => ({
        enrolledStudents: [...state.enrolledStudents, response.data.data],
        loading: false,
      }));
      console.log(response.data)
      return response.data.data;
    } catch (error) {
      const message =
        error.response?.data?.message || "Failed to enroll student";
      set({ error: message, loading: false });
      throw error;
    }
  },

  unenrollStudent: async (assessmentId, studentId) => {
    set({ loading: true, error: null });
    try {
      await unenrollStudentApi(assessmentId, studentId);
      set((state) => ({
        enrolledStudents: state.enrolledStudents.filter(
          (s) => s.id !== studentId
        ),
        loading: false,
      }));
    } catch (error) {
      const message =
        error.response?.data?.message ||
        "Failed to unenroll student";
      set({ error: message, loading: false });
      throw error;
    }
  },

  /* =========================
     AI Preview
  ========================= */

  fetchPreviewQuestions: async (assessmentId) => {
    set({ loading: true, error: null });
    try {
      const response = await fetchPreviewQuestionsApi(assessmentId);
      set({ loading: false });
      return response.data.questions;
    } catch (error) {
      const message =
        error.response?.data?.message ||
        "Failed to generate preview questions";
      set({ error: message, loading: false });
      throw error;
    }
  },

  /* =========================
     Utilities
  ========================= */

  clearError: () => set({ error: null }),
  clearCurrentAssessment: () => set({ currentAssessment: null }),
}));

export default useAssessmentStore;
