import { create } from "zustand";
import i18n from "../i18n/index.js";
import { fetchAssessmentsAPI } from "../api/studentAnalytics.api.js";
import { reportError } from "../utils/reportError.js";

/** Enrolled assessments with status (not_started / in_progress / completed) for the dashboard. */
const useStudentAnalyticsStore = create((set) => ({
  assessments: [],
  loading: false,
  error: null,

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
}));

export default useStudentAnalyticsStore;
