import { create } from "zustand";
import i18n from "../i18n/index.js";
import {
  fetchAssessmentsAPI,
  fetchAssessmentDetailsAPI,
  fetchReportAPI,
  fetchAssessmentQuestionsAPI,
} from "../api/studentAnalytics.api.js";
import { reportError } from "../utils/reportError.js";

const useStudentAnalyticsStore = create((set) => ({
  assessments: [],
  selectedAssessment: null,
  selectedAssessmentDetails: null,
  questions: [],
  loading: false,
  questionsLoading: false,
  downloading: false,
  error: null,

  /** Enrolled assessments with status (not_started / in_progress / completed). */
  fetchAssessments: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetchAssessmentsAPI();
      set({ assessments: res.data.data || [] });
    } catch (err) {
      set({ assessments: [], error: reportError(err, i18n.t("studentDashboard.loadFailed"), { silent: true }) });
    } finally {
      set({ loading: false });
    }
  },

  setSelectedAssessment: (id) => set({ selectedAssessment: id }),

  fetchAssessmentDetails: async (id) => {
    set({ loading: true, selectedAssessmentDetails: null });
    try {
      const res = await fetchAssessmentDetailsAPI(id);
      set({ selectedAssessmentDetails: res.data.data });
    } catch (err) {
      reportError(err, i18n.t("results.loadFailed"));
    } finally {
      set({ loading: false });
    }
  },

  fetchAssessmentQuestions: async (assessmentId) => {
    set({ questionsLoading: true, questions: [] });
    try {
      const res = await fetchAssessmentQuestionsAPI(assessmentId);
      set({ questions: res.data.data || [] });
    } catch (err) {
      reportError(err, i18n.t("errors.store.loadQuestions"));
    } finally {
      set({ questionsLoading: false });
    }
  },

  /** Build and download a PDF with the stats, weak areas and study plan. */
  downloadReport: async (assessmentId) => {
    set({ downloading: true });
    try {
      const [res, { buildStudentReportPdf }] = await Promise.all([
        fetchReportAPI(assessmentId),
        import("../utils/studentReportPdf.js"), // jsPDF is only loaded on demand
      ]);
      const pdf = await buildStudentReportPdf(res.data.data);
      pdf.save(`Assessment_Report_${assessmentId}.pdf`);
    } catch (err) {
      reportError(err, i18n.t("errors.store.report"));
    } finally {
      set({ downloading: false });
    }
  },
}));

export default useStudentAnalyticsStore;
