import { create } from "zustand";
import {
  startAssessmentApi,
  submitAssessmentApi,
  printAssessmentApi,
  getSubmissionDetailsApi,
} from "../api/studentAssessment.api";
import useStudentAnalyticsStore from "./useStudentAnalyticsStore";

const useStudentAssessmentStore = create((set, get) => ({
  assessmentQuestions: [],
  timeRemaining: 0,
  loading: false,
  error: null,
  isSubmitted: false,
  submission: null,
  attemptId: null,
  language: "en",
  hasStarted: false,

  /* =========================
     Start Assessment
  ========================= */

  startAssessment: async (assessmentId, language = "en") => {
    set({ loading: true, error: null });

    try {
      const response = await startAssessmentApi(assessmentId, { language });

      if (!response.data.success) {
        throw new Error(response.data.message);
      }

      const { questions, duration, attemptId } = response.data.data;

      const parsedQuestions = questions.map((q) => {
        let parsedOptions = null;

        try {
          parsedOptions =
            q.options && typeof q.options === "string"
              ? JSON.parse(q.options)
              : q.options;

          if (!Array.isArray(parsedOptions)) parsedOptions = null;
        } catch {
          parsedOptions = null;
        }

        return {
          ...q,
          answer: null,
          options: parsedOptions,
        };
      });

      set({
        assessmentQuestions: parsedQuestions,
        timeRemaining: (duration || 15) * 60,
        isSubmitted: false,
        attemptId,
        language,
        hasStarted: true,
        loading: false,
      });
    } catch (error) {
      set({
        error:
          error.response?.data?.message ||
          error.message ||
          "Failed to start assessment",
        loading: false,
        hasStarted: false,
      });
    }
  },

  /* =========================
     Update Answer
  ========================= */

  updateAnswer: (questionId, answer) => {
    set((state) => ({
      assessmentQuestions: state.assessmentQuestions.map((q) =>
        q.id === questionId ? { ...q, answer } : q
      ),
    }));
  },

  /* =========================
     Submit Assessment
  ========================= */

  submitAssessment: async (assessmentId) => {
    const { attemptId, hasStarted, language, assessmentQuestions } = get();

    if (!hasStarted || !attemptId) {
      set({ error: "Assessment not started" });
      return;
    }

    set({ loading: true, error: null });

    try {
      const answers = assessmentQuestions.map((q) => ({
        questionId: q.id,
        answer: q.answer,
      }));

      const response = await submitAssessmentApi(assessmentId, {
        attemptId,
        answers,
        language,
      });

      if (!response.data.success) {
        throw new Error(response.data.message);
      }

      set({
        isSubmitted: true,
        submission: response.data.data,
        loading: false,
      });

      // Sync analytics
      const analytics = useStudentAnalyticsStore.getState();
      analytics.fetchOverview();
      analytics.fetchPerformance();
      analytics.fetchRecommendations();
    } catch (error) {
      set({
        error:
          error.response?.data?.message ||
          error.message ||
          "Failed to submit assessment",
        loading: false,
      });
    }
  },

  /* =========================
     Print Assessment
  ========================= */

  printPaper: async (assessmentId) => {
    set({ loading: true, error: null });

    try {
      const response = await printAssessmentApi(assessmentId);

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `assessment_${assessmentId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      set({ loading: false });
    } catch (error) {
      set({
        error:
          error.response?.data?.message ||
          error.message ||
          "Failed to print assessment",
        loading: false,
      });
    }
  },

  /* =========================
     Submission Details
  ========================= */

  getSubmissionDetails: async (submissionId) => {
    set({ loading: true, error: null, submission: null });

    try {
      const response = await getSubmissionDetailsApi(submissionId);

      if (!response.data.success) {
        throw new Error(response.data.message);
      }

      set({ submission: response.data.data, loading: false });
    } catch (error) {
      set({
        error:
          error.response?.data?.message ||
          error.message ||
          "Failed to load submission details",
        loading: false,
      });
    }
  },

  /* =========================
     Utilities
  ========================= */

  clearError: () => set({ error: null }),

  reset: () =>
    set({
      assessmentQuestions: [],
      timeRemaining: 0,
      loading: false,
      error: null,
      isSubmitted: false,
      submission: null,
      attemptId: null,
      hasStarted: false,
    }),
}));

export default useStudentAssessmentStore;
