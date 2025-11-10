import { create } from "zustand";
import axios from "axios";
import toast from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const useDashboardStore = create((set) => ({
  overview: {
    assessments: 0,
    executedAssessments: 0,
    resources: 0,
  },
  loading: false,
  error: null,

  getInstructorOverview: async () => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No authentication token found");
      }
      const response = await axios.get(`${API_URL}/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        set({ overview: response.data.data, loading: false });
        console.log(`✅ Dashboard overview fetched: ${JSON.stringify(response.data.data)}`);
      } else {
        throw new Error(response.data.message || "Failed to fetch overview");
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || "Failed to fetch overview";
      console.error("❌ Get dashboard overview error:", error);
      set({ error: errorMessage, loading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));

export default useDashboardStore;