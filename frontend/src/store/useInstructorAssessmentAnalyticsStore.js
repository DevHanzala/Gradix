import { create } from "zustand";
import toast from "react-hot-toast";
import {
  fetchInstructorAssessmentsAPI,
  fetchAssessmentStudentsAPI,
  fetchStudentQuestionsAPI,
  fetchInstructorOverviewAPI,
} from "../api/instructorAnalytics.api.js";

const useInstructorAnalyticsStore = create((set) => ({
  /* =========================
     DASHBOARD (MERGED)
     ========================= */
  overview: {
    assessments: 0,
    executedAssessments: 0,
    resources: 0,
  },

  /* =========================
     ANALYTICS STATE
     ========================= */
  loading: false,
  error: null,

  assessments: [],
  students: [],
  studentQuestions: [],

  selectedAssessmentId: null,
  selectedStudentId: null,

  /* =========================
     DASHBOARD ACTIONS
     ========================= */
  getInstructorOverview: async () => {
    try {
      set({ loading: true, error: null });
      const res = await fetchInstructorOverviewAPI();
      set({
        overview: res.data.data || {},
        loading: false,
      });
    } catch (err) {
      const msg = err.message || "Failed to fetch overview";
      set({ error: msg, loading: false });
      toast.error(msg);
      throw err;
    }
  },

  /* =========================
     ANALYTICS ACTIONS
     ========================= */
  fetchAssessments: async () => {
    try {
      set({
        loading: true,
        error: null,
        students: [],
        studentQuestions: [],
        selectedAssessmentId: null,
        selectedStudentId: null,
      });

      const res = await fetchInstructorAssessmentsAPI();
      set({
        assessments: res.data.data || [],
        loading: false,
      });
    } catch (err) {
      const msg = err.message || "Failed to fetch assessments";
      set({ error: msg, loading: false });
      toast.error(msg);
    }
  },

  fetchAssessmentStudents: async (assessmentId) => {
    try {
      set({
        loading: true,
        error: null,
        students: [],
        studentQuestions: [],
        selectedStudentId: null,
      });

      const res = await fetchAssessmentStudentsAPI(assessmentId);
      set({
        students: res.data.data || [],
        selectedAssessmentId: assessmentId,
        loading: false,
      });
    } catch (err) {
      const msg = err.message || "Failed to fetch students";
      set({ error: msg, loading: false });
      toast.error(msg);
    }
  },

  fetchStudentQuestions: async (assessmentId, studentId) => {
    try {
      set({
        loading: true,
        error: null,
        studentQuestions: [],
        selectedStudentId: null,
      });

      const res = await fetchStudentQuestionsAPI(assessmentId, studentId);
      set({
        studentQuestions: res.data.data || [],
        selectedStudentId: studentId,
        loading: false,
      });
    } catch (err) {
      const msg = err.message || "Failed to load answers";
      set({
        error: msg,
        studentQuestions: [],
        selectedStudentId: null,
        loading: false,
      });
      toast.error(msg);
    }
  },

  /* =========================
     HELPERS
     ========================= */
  clearError: () => set({ error: null }),
}));

export default useInstructorAnalyticsStore;
