import { create } from "zustand";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import useStudentAnalyticsStore from "./useStudentAnalyticsStore.js";

const API_URL = import.meta.env.VITE_API_URL || "https://gradeadmin.techmiresolutions.com/api";

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

  startAssessment: async (assessmentId, language = "en") => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.warn("⚠️ No token found in localStorage");
        set({ error: "Please log in to start the assessment", loading: false });
        const navigate = useNavigate();
        navigate("/login");
        return;
      }
      console.log(`📝 Sending request to start assessment with ID ${assessmentId} and language ${language}`);
      const response = await axios.post(
        `${API_URL}/taking/assessments/${assessmentId}/start`,
        { language },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        set({
          assessmentQuestions: response.data.data.questions.map((q) => {
            console.log(`📋 Processing question ${q.id}: options = ${q.options}, correct_answer = ${JSON.stringify(q.correct_answer)}`);
            let parsedOptions = null;
            try {
              parsedOptions = q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : null;
              if (!Array.isArray(parsedOptions)) {
                console.warn(`⚠️ Invalid options format for question ${q.id}:`, q.options);
                parsedOptions = null;
              }
            } catch (e) {
              console.error(`❌ Failed to parse options for question ${q.id}:`, e.message, q.options);
              parsedOptions = null;
            }
            return {
              ...q,
              answer: null,
              options: parsedOptions,
              correct_answer: q.correct_answer,
              positive_marks: q.positive_marks,
              negative_marks: q.negative_marks,
              duration_per_question: q.duration_per_question,
            };
          }),
          timeRemaining: (response.data.data.duration || 15) * 60,
          isSubmitted: false,
          attemptId: response.data.data.attemptId,
          language,
          loading: false,
          hasStarted: true,
        });
        console.log(`✅ Assessment ${assessmentId} started, attemptId: ${response.data.data.attemptId}`);
      } else {
        throw new Error(response.data.message || "Failed to start assessment");
      }
    } catch (error) {
      console.error(`❌ startAssessment error for ID ${assessmentId}:`, error.response?.data || error);
      const message =
        error.response?.data?.message === "Assessment not found"
          ? `Assessment with ID ${assessmentId} does not exist. Please check the assessment ID or contact your instructor.`
          : error.response?.data?.message || "Failed to start assessment";
      set({ error: message, loading: false, hasStarted: false });
      if (message.includes("log in")) {
        const navigate = useNavigate();
        navigate("/login");
      }
    }
  },

  updateAnswer: (questionId, answer) => {
    set((state) => ({
      assessmentQuestions: state.assessmentQuestions.map((q) =>
        q.id === questionId ? { ...q, answer } : q
      ),
    }));
  },

  submitAssessment: async (assessmentId) => {
    const { attemptId, hasStarted, language, assessmentQuestions } = get();
    if (!hasStarted || !attemptId) {
      console.warn("⚠️ Cannot submit: Assessment not started");
      set({ error: "Assessment not started", loading: false });
      return;
    }
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.warn("⚠️ No token found in localStorage");
        set({ error: "Please log in to submit the assessment", loading: false });
        const navigate = useNavigate();
        navigate("/login");
        return;
      }
      const answers = assessmentQuestions.map((q) => ({
        questionId: q.id,
        answer: q.answer,
      }));
      console.log(`📝 Submitting assessment ${assessmentId}, attempt ${attemptId}, answers:`, answers);
      const response = await axios.post(
        `${API_URL}/taking/assessments/${assessmentId}/submit`,
        { attemptId, answers, language },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        set({ isSubmitted: true, loading: false, submission: response.data.data });
        // Update analytics
        useStudentAnalyticsStore.getState().fetchOverview();
        useStudentAnalyticsStore.getState().fetchPerformance();
        useStudentAnalyticsStore.getState().fetchRecommendations();
      } else {
        throw new Error(response.data.message || "Failed to submit assessment");
      }
    } catch (error) {
      console.error("❌ submitAssessment error:", error.response?.data || error);
      const message = error.response?.data?.message || "Failed to submit assessment";
      set({ error: message, loading: false });
      if (message.includes("log in")) {
        const navigate = useNavigate();
        navigate("/login");
      }
    }
  },

  printPaper: async (assessmentId) => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.warn("⚠️ No token found in localStorage for print");
        set({ error: "Please log in to print the assessment", loading: false });
        const navigate = useNavigate();
        navigate("/login");
        return;
      }
      const response = await axios.get(`${API_URL}/taking/assessments/${assessmentId}/print`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `assessment_${assessmentId}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      set({ loading: false });
    } catch (error) {
      console.error("❌ printPaper error:", error.response?.data || error);
      const message = error.response?.data?.message || "Failed to print assessment";
      set({ error: message, loading: false });
      if (message.includes("log in")) {
        const navigate = useNavigate();
        navigate("/login");
      }
    }
  },

  decrementTime: () => {
    set((state) => ({
      timeRemaining: state.timeRemaining > 0 ? state.timeRemaining - 1 : 0,
    }));
  },

  getSubmissionDetails: async (submissionId) => {
    set({ loading: true, error: null, submission: null });
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.warn("⚠️ No token found in localStorage for submission details");
        set({ error: "Please log in to view submission details", loading: false });
        const navigate = useNavigate();
        navigate("/login");
        return;
      }
      const response = await axios.get(`${API_URL}/taking/submissions/${submissionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        set({ submission: response.data.data, loading: false });
      } else {
        throw new Error(response.data.message || "Failed to load submission details");
      }
    } catch (error) {
      console.error("❌ getSubmissionDetails error:", error.response?.data || error);
      const message = error.response?.data?.message || "Failed to load submission details";
      set({ error: message, loading: false });
      if (message.includes("log in")) {
        const navigate = useNavigate();
        navigate("/login");
      }
    }
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set({
      assessmentQuestions: [],
      timeRemaining: 0,
      loading: false,
      error: null,
      isSubmitted: false,
      submission: null,
      attemptId: null,
      hasStarted: false,
    });
  },
}));

export default useStudentAssessmentStore;