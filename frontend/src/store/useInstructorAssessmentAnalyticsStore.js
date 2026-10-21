import { create } from "zustand";
import i18n from "../i18n/index.js";
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
      const msg = err.response?.data?.message || err.message || i18n.t("dashboard.loadFailed");
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
      const msg = err.response?.data?.message || err.message || i18n.t("errors.store.loadAssessments");
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
      const msg = err.response?.data?.message || err.message || i18n.t("errors.store.loadStudents");
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
      const msg = err.response?.data?.message || err.message || i18n.t("errors.store.loadAnswers");
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
