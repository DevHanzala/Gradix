import { create } from "zustand";
import axios from "axios";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import useAuthStore from "./authStore.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const useStudentAnalyticsStore = create((set, get) => ({
  analytics: null,
  performance: [],
  recommendations: null,
  assessments: [],
  selectedAssessment: null,
  selectedAssessmentDetails: null,
  loading: false,
  error: null,

  fetchOverview: async () => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");
      const response = await axios.get(`${API_URL}/student-analytics/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        set({ analytics: response.data.data || {} });
      } else {
        throw new Error(response.data.message || "Failed to fetch overview");
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || "Failed to fetch overview";
      set({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ loading: false });
    }
  },

  fetchPerformance: async (timeRange = "month") => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");
      const response = await axios.get(`${API_URL}/student-analytics/performance?timeRange=${timeRange}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        set({ performance: response.data.data.performance_data || [] });
      } else {
        throw new Error(response.data.message || "Failed to fetch performance data");
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || "Failed to fetch performance data";
      set({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ loading: false });
    }
  },

  fetchRecommendations: async () => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");
      const response = await axios.get(`${API_URL}/student-analytics/recommendations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        set({ recommendations: response.data.data || { weak_areas: [], study_plan: {} } });
      } else {
        throw new Error(response.data.message || "Failed to fetch recommendations");
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || "Failed to fetch recommendations";
      set({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ loading: false });
    }
  },

  fetchAssessments: async () => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");
      const response = await axios.get(`${API_URL}/student-analytics/assessments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        set({ assessments: response.data.data || [] });
      } else {
        throw new Error(response.data.message || "Failed to fetch assessments");
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || "Failed to fetch assessments";
      set({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ loading: false });
    }
  },

  fetchAssessmentDetails: async (id) => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");
      const response = await axios.get(`${API_URL}/student-analytics/assessment/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        set({ selectedAssessmentDetails: response.data.data || {} });
      } else {
        throw new Error(response.data.message || "Failed to fetch assessment details");
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || "Failed to fetch assessment details";
      set({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      set({ loading: false });
    }
  },

  setSelectedAssessment: (id) => {
    set({ selectedAssessment: id });
    if (id) {
      get().fetchAssessmentDetails(id);
    } else {
      set({ selectedAssessmentDetails: null });
    }
  },
// UPDATE IN useStudentAnalyticsStore.js — CALL BACKEND FOR REPORT DATA

downloadReport: async (assessmentId = null) => {
  set({ loading: true, error: null });
  try {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("No authentication token found");
    if (!assessmentId) throw new Error("No assessment selected");

    // Fetch report data from backend (includes negative_marks_applied)
    const response = await axios.get(`${API_URL}/student-analytics/report?assessmentId=${assessmentId}&format=json`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.data.success) throw new Error("Failed to fetch report data");

    const details = response.data.data;

    // Student data
    const { user } = useAuthStore.getState();
    const studentName = user.name || 'Student';
    const studentId = user.id || 'N/A';
    const studentEmail = user.email || 'N/A';

    // USE THE CORRECT VALUE FROM BACKEND — NO RECALCULATION NEEDED
    const negativeMarksApplied = parseFloat(details.negative_marks_applied) || 0;

    // Create report HTML — your original beautiful format
    const reportElement = document.createElement("div");
    reportElement.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 30px; width: 100%; max-width: 800px; margin: 0 auto; background: #fff; box-shadow: 0 0 15px rgba(0,0,0,0.1);">
        <div style="text-align: center; padding: 15px; background: linear-gradient(to right, #4b5bd7, #a84bff); color: white; font-size: 24px; border-bottom: 2px solid #fff;">
          📚 Gradwise AI
        </div>
        <h1 style="text-align: center; margin: 20px 0; color: #333; font-size: 28px; border-bottom: 2px solid #4b5bd7; padding-bottom: 10px;">Assessment Report Card</h1>
        <h2 style="color: #4b5bd7; font-size: 20px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Student Information</h2>
        <ul style="list-style: none; padding-left: 0; margin-top: 10px;">
          <li style="margin-bottom: 8px;"><strong>Name:</strong> ${studentName}</li>
          <li style="margin-bottom: 8px;"><strong>Student ID:</strong> ${studentId}</li>
          <li style="margin-bottom: 8px;"><strong>Email:</strong> ${studentEmail}</li>
          <li style="margin-bottom: 8px;"><strong>Date:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi', hour12: true })} PKT</li>
        </ul>
        <h2 style="color: #4b5bd7; font-size: 20px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Assessment Details</h2>
        <table style="width: 100%; margin-top: 10px; border-collapse: collapse;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Title:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${details.assessment_title || 'N/A'}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Score:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${details.score || 0}% <span style="color: green;">✔</span></td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Time Taken:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${formatTime(details.time_taken || 0)}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Total Marks:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${details.total_marks || 0}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Obtained Marks:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${details.student_score || 0} <span style="color: green;">✔</span></td></tr>
          <tr><td style="padding: 8px;"><strong>Correct Answers:</strong></td><td style="padding: 8px;">${details.correct_answers} <span style="color: green;">✔</span></td></tr>
          <tr><td style="padding: 8px;"><strong>Incorrect Answers:</strong></td><td style="padding: 8px;">${details.incorrect_answers} <span style="color: red;">✖</span></td></tr>
          <tr><td style="padding: 8px;"><strong>Negative Marks Applied:</strong></td><td style="padding: 8px;">${negativeMarksApplied > 0 ? `-${negativeMarksApplied}` : 0}</td></tr>
        </table>
        <h2 style="color: #4b5bd7; font-size: 20px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Assessment Topics</h2>
        <ul style="list-style: disc; padding-left: 20px; margin-top: 10px;">
          <li>True/False Analysis</li>
          <li>Critical Thinking</li>
          <li>Fact Verification</li>
        </ul>
        <h2 style="color: #4b5bd7; font-size: 20px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Areas of Improvement</h2>
        <ul style="list-style: disc; padding-left: 20px; margin-top: 10px;">
          ${details.recommendations.weak_areas.length > 0 ?
            details.recommendations.weak_areas.map(area => `<li style="margin-bottom: 10px;"><strong>${area.topic}</strong> (Performance: ${area.performance}%)<br><em>Suggestion:</em> ${area.suggestion}</li>`).join('')
            : '<li>No specific weak areas identified.</li>'}
        </ul>
        <h2 style="color: #4b5bd7; font-size: 20px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Learning Recommendations</h2>
        <h3 style="margin-top: 10px; color: #666;">Daily Practice</h3>
        <ul style="list-style: disc; padding-left: 20px; margin-top: 5px;">
          ${details.recommendations.study_plan.daily_practice.length > 0 ?
            details.recommendations.study_plan.daily_practice.map(practice => `<li style="margin-bottom: 5px;"><strong>${practice.topic}:</strong> ${practice.focus} (${practice.time_allocation || 'N/A'})</li>`).join('')
            : '<li>No daily practice recommended.</li>'}
        </ul>
        <h3 style="margin-top: 10px; color: #666;">Weekly Review</h3>
        <ul style="list-style: disc; padding-left: 20px; margin-top: 5px;">
          ${details.recommendations.study_plan.weekly_review.length > 0 ?
            details.recommendations.study_plan.weekly_review.map(review => `<li style="margin-bottom: 5px;"><strong>${review.topic}:</strong> ${review.activity} - ${review.goal || 'N/A'}</li>`).join('')
            : '<li>No weekly review recommended.</li>'}
        </ul>
      </div>
    `;

    document.body.appendChild(reportElement);

    const pdf = new jsPDF();
    await html2canvas(reportElement, { scale: 2, useCORS: true }).then((canvas) => {
      const imgData = canvas.toDataURL("image/png");
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
      if (pdfHeight > pdf.internal.pageSize.getHeight()) {
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position - pdf.internal.pageSize.getHeight(), pdfWidth, pdfHeight);
      }
      pdf.save(`Assessment_Report_${assessmentId}.pdf`);
    });

    document.body.removeChild(reportElement);
    toast.success("Report downloaded successfully!");
  } catch (error) {
    console.error("Report generation failed:", error);
    toast.error("Failed to generate report");
  } finally {
    set({ loading: false });
  }
},

  clearError: () => set({ error: null }),
}));

// Helper functions
const formatTime = (seconds) => {
  if (isNaN(seconds) || seconds <= 0) return "0h 0m 0s";
  seconds = Math.floor(seconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${hours}h ${minutes}m ${remainingSeconds}s`;
};

const calculateAssessmentStats = (details) => {
  if (!details || !details.recommendations?.weak_areas) return { total: 0, correct: 0, incorrect: 0 };
  const total = details.total_questions || 0;
  const correct = details.correct_answers || 0;
  const incorrect = details.incorrect_answers || 0;
  return { total, correct, incorrect };
};

export default useStudentAnalyticsStore;