import { create } from "zustand";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import useAuthStore from "./authStore.js";
import {
  fetchOverviewAPI,
  fetchAssessmentsAPI,
  fetchPerformanceAPI,
  fetchRecommendationsAPI,
  fetchAssessmentDetailsAPI,
  fetchReportAPI,
  fetchAssessmentQuestionsAPI,
} from "../api/studentAnalytics.api.js";

const useStudentAnalyticsStore = create((set) => ({
   assessments: [],
  selectedAssessment: null,
  analytics: null,
  performance: [],
  recommendations: null,
  selectedAssessmentDetails: null,
  loading: false,
  error: null,
  questions: [],
questionsLoading: false,


fetchAssessments: async () => {
    try {
      set({ loading: true, error: null });
      const res = await fetchAssessmentsAPI();
      set({ assessments: res.data.data || [] });
    } catch (err) {
      set({ assessments: [], error: err.message });
    } finally {
      set({ loading: false });
    }
  },

  setSelectedAssessment: (id) => set({ selectedAssessment: id }),


  fetchOverview: async () => {
    try {
      set({ loading: true });
      const res = await fetchOverviewAPI();
      set({ analytics: res.data.data });
    } catch (err) {
    } finally {
      set({ loading: false });
    }
  },

  fetchPerformance: async (timeRange = "month") => {
    try {
      set({ loading: true });
      const res = await fetchPerformanceAPI(timeRange);
      set({ performance: res.data.data.performance_data || [] });
    } catch (err) {
    } finally {
      set({ loading: false });
    }
  },

  fetchRecommendations: async () => {
    try {
      set({ loading: true });
      const res = await fetchRecommendationsAPI();
      set({ recommendations: res.data.data });
    } catch (err) {
    } finally {
      set({ loading: false });
    }
  },

  fetchAssessmentDetails: async (id) => {
    try {
      set({ loading: true });
      const res = await fetchAssessmentDetailsAPI(id);
      set({ selectedAssessmentDetails: res.data.data });
    } catch (err) {
    } finally {
      set({ loading: false });
    }
  },

  fetchAssessmentQuestions: async (assessmentId) => {
  try {
    set({ questionsLoading: true });
    const res = await fetchAssessmentQuestionsAPI(assessmentId);
    set({ questions: res.data.data || [] });
  } catch (err) {
    set({ error: err.message || "Failed to fetch questions" });
  } finally {
    set({ questionsLoading: false });
  }
},


  downloadReport: async (assessmentId) => {
    try {
      set({ loading: true });
      const res = await fetchReportAPI(assessmentId);
      const details = res.data.data;
      const { user } = useAuthStore.getState();

      const container = document.createElement("div");
      container.innerHTML = `<h1>${details.assessment_title}</h1>`;
      document.body.appendChild(container);

      const canvas = await html2canvas(container);
      const pdf = new jsPDF();
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297);
      pdf.save(`Assessment_Report_${assessmentId}.pdf`);

      document.body.removeChild(container);
    } catch (err) {
      toast.error("Failed to generate report");
    } finally {
      set({ loading: false });
    }
  },
}));

export default useStudentAnalyticsStore;
