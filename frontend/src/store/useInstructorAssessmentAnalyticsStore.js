import { create } from "zustand";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const useInstructorAnalyticsStore = create((set, get) => ({
  loading: false,
  error: null,
  assessments: [],
  students: [],
  selectedAssessmentId: null,
  selectedStudentId: null,
  studentQuestions: [],

  fetchAssessments: async () => {
    set({ loading: true, error: null, students: [], selectedAssessmentId: null, selectedStudentId: null, studentQuestions: [] });
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");
      console.log(`🔍 Fetching assessments from ${API_URL}/instructor-analytics/assessments`);
      const response = await axios.get(`${API_URL}/instructor-analytics/assessments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log(`📦 Response received:`, response.data);
      if (response.data.success) {
        set({ assessments: response.data.data || [], error: null });
      } else {
        throw new Error(response.data.message || "Failed to fetch assessments");
      }
    } catch (error) {
      console.error(`❌ Error fetching assessments:`, error);
      set({ error: error.message || "Failed to fetch assessments" });
    } finally {
      set({ loading: false });
    }
  },

  fetchAssessmentStudents: async (assessmentId) => {
    set({ loading: true, error: null, students: [], selectedStudentId: null, studentQuestions: [] });
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");
      console.log(`🔍 Fetching students for assessment ${assessmentId}`);
      const response = await axios.get(`${API_URL}/instructor-analytics/assessment/${assessmentId}/students`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log(`📦 Student response received:`, response.data);
      if (response.data.success) {
        set({ students: response.data.data || [], selectedAssessmentId: assessmentId });
      } else {
        throw new Error(response.data.message || "Failed to fetch students");
      }
    } catch (error) {
      console.error(`❌ Error fetching students:`, error);
      set({ error: error.message || "Failed to fetch students" });
    } finally {
      set({ loading: false });
    }
  },

  fetchStudentQuestions: async (assessmentId, studentId) => {
  set({ loading: true, error: null, studentQuestions: [], selectedStudentId: null }); // ← ADD selectedStudentId = null first
  
  try {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("No authentication token found");

    const response = await axios.get(
      `${API_URL}/instructor-analytics/assessment/${assessmentId}/student/${studentId}/questions`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.data.success) {
      set({
        studentQuestions: response.data.data || [],
        selectedStudentId: studentId,  // ← THIS WAS MISSING!
        loading: false
      });
    } else {
      throw new Error(response.data.message);
    }
  } catch (error) {
    console.error("Error fetching student questions:", error);
    set({ 
      error: error.message || "Failed to load answers",
      studentQuestions: [],
      selectedStudentId: null,
      loading: false 
    });
  }
},

}));

export default useInstructorAnalyticsStore;