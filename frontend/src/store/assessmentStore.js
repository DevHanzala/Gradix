import { create } from "zustand";
import axios from "axios";
import toast from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const useAssessmentStore = create((set) => ({
  assessments: [],
  studentAssessments: [],
  getStudentAssessments: async () => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");
      const response = await axios.get(`${API_URL}/taking/assessments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        set({ studentAssessments: response.data.data || [], loading: false });
      } else {
        set({ error: response.data.message, loading: false });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || "Failed to fetch student assessments";
      set({ error: errorMessage, loading: false, studentAssessments: [] });
      toast.error(errorMessage);
      throw error;
    }
  },
  currentAssessment: null,
  enrolledStudents: [],
  loading: false,
  error: null,

  getInstructorAssessments: async () => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");
      const response = await axios.get(`${API_URL}/assessments/instructor`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        // Assuming the API returns an `is_executed` field or similar to indicate execution status
        set({ assessments: response.data.data.map(assessment => ({
          ...assessment,
          is_executed: assessment.is_executed || false // Default to false if not present
        })), loading: false });
      } else {
        set({ error: response.data.message, loading: false });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || "Failed to fetch assessments";
      set({ error: errorMessage, loading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  getAssessmentById: async (assessmentId) => {
    set({ loading: true, error: null });
    try {
      if (!assessmentId || isNaN(parseInt(assessmentId))) {
        throw new Error("Invalid assessment ID");
      }
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");
      const response = await axios.get(`${API_URL}/assessments/${parseInt(assessmentId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        set({ currentAssessment: response.data.data, loading: false });
        return response.data.data;
      } else {
        throw new Error(response.data.message);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || "Failed to fetch assessment";
      set({ error: errorMessage, loading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

 createAssessment: async (assessmentData) => {
  set({ loading: true, error: null });
  try {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("No authentication token found");

    // === NEW VALIDATION ===
    const title = assessmentData.get("title");
    const prompt = assessmentData.get("prompt");
    const externalLinks = JSON.parse(assessmentData.get("externalLinks") || "[]");
    const questionBlocks = JSON.parse(assessmentData.get("question_blocks") || "[]");
    const selectedResources = JSON.parse(assessmentData.get("selected_resources") || "[]");
    const newFiles = assessmentData.getAll("new_files");

    if (!title?.trim()) {
      throw new Error("Assessment Title is required");
    }

    const hasResources = selectedResources.length > 0 || newFiles.length > 0;
    const hasLinks = externalLinks.some(link => link && link.trim());

    if (!prompt?.trim() && !hasResources && !hasLinks) {
      throw new Error("You must provide either a Prompt, Resources, or External Links");
    }

    // Question blocks validation (same)
    if (questionBlocks.length > 0) {
      for (const block of questionBlocks) {
        if (!block.question_count || block.question_count < 1) {
          throw new Error("Question count must be at least 1");
        }
        if (!block.duration_per_question || block.duration_per_question < 30) {
          throw new Error("Duration per question must be at least 30 seconds");
        }
        if (block.question_type === "multiple_choice" && (!block.num_options || block.num_options < 2)) {
          throw new Error("Multiple choice needs at least 2 options");
        }
      }
    }

    // Rebuild FormData (same as before)
    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("prompt", prompt?.trim() || null);
    formData.append("externalLinks", JSON.stringify(externalLinks.filter(link => link && link.trim())));
    formData.append("question_blocks", JSON.stringify(questionBlocks));
    formData.append("selected_resources", JSON.stringify(selectedResources));
    newFiles.forEach(file => formData.append("new_files", file));

    const response = await axios.post(`${API_URL}/assessments`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
    });

    if (response.data.success) {
      set((state) => ({
        assessments: [...state.assessments, { ...response.data.data, is_executed: false }],
        loading: false,
      }));
      return response.data.data;
    } else {
      throw new Error(response.data.message);
    }
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message || "Failed to create assessment";
    set({ error: errorMessage, loading: false });
    toast.error(errorMessage);
    throw error;
  }
},

updateAssessment: async (assessmentId, assessmentData) => {
  set({ loading: true, error: null });
  try {
    if (!assessmentId || isNaN(parseInt(assessmentId))) {
      throw new Error("Invalid assessment ID");
    }
    const token = localStorage.getItem("token");
    if (!token) throw new Error("No authentication token found");

    // === DEBUG: See what we're sending ===
    console.log("Updating assessment ID:", assessmentId);
    for (let [key, value] of assessmentData.entries()) {
      console.log(`FormData → ${key}:`, value);
    }

    // === EXTRACT VALUES SAFELY ===
    const title = assessmentData.get("title")?.trim();
    const prompt = assessmentData.get("prompt")?.trim();
    const externalLinks = JSON.parse(assessmentData.get("externalLinks") || "[]");
    const selectedResources = JSON.parse(assessmentData.get("selected_resources") || "[]");
    const newFiles = assessmentData.getAll("new_files"); // FileList

    // === VALIDATION ===
    if (!title) {
      throw new Error("Assessment Title is required");
    }

    // Allow empty prompt IF there is at least one of:
    // - existing selected resources
    // - new uploaded files
    // - external links
    const hasLinks = externalLinks.some(l => l && l.trim());
    const hasOldResources = selectedResources.length > 0;
    const hasNewFiles = newFiles.length > 0;

    if (!prompt && !hasLinks && !hasOldResources && !hasNewFiles) {
      throw new Error("You must keep the existing prompt OR provide new Prompt, Resources, or Links");
    }

    // Optional: Validate question blocks (same as create)
    const question_blocks = JSON.parse(assessmentData.get("question_blocks") || "[]");
    if (question_blocks.length > 0) {
      for (const block of question_blocks) {
        if (!block.question_count || block.question_count < 1) {
          throw new Error("Question count must be at least 1");
        }
        if (!block.duration_per_question || block.duration_per_question < 30) {
          throw new Error("Duration per question must be at least 30 seconds");
        }
        if (block.question_type === "multiple_choice" && (!block.num_options || block.num_options < 2)) {
          throw new Error("Multiple choice needs at least 2 options");
        }
      }
    }

    // === SEND REQUEST ===
    const response = await axios.put(
      `${API_URL}/assessments/${parseInt(assessmentId)}`,
      assessmentData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          // Let browser set Content-Type with boundary
        },
      }
    );

    if (response.data.success) {
      const updatedAssessment = response.data.data;

      set((state) => ({
        assessments: state.assessments.map((a) =>
          a.id === assessmentId ? { ...updatedAssessment, is_executed: a.is_executed } : a
        ),
        currentAssessment: updatedAssessment,
        loading: false,
      }));

      toast.success("Assessment updated successfully!");
      return updatedAssessment;
    } else {
      throw new Error(response.data.message || "Update failed");
    }
  } catch (error) {
    const errorMessage =
      error.response?.data?.message ||
      error.message                          ||
      "Failed to update assessment";

    console.error("Update Assessment Error:", errorMessage);
    set({ error: errorMessage, loading: false });
    toast.error(errorMessage);
    throw error;
  }
},

  deleteAssessment: async (assessmentId) => {
    set({ loading: true, error: null });
    try {
      if (!assessmentId || isNaN(parseInt(assessmentId))) {
        throw new Error("Invalid assessment ID");
      }
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");
      const response = await axios.delete(`${API_URL}/assessments/${parseInt(assessmentId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        set((state) => ({
          assessments: state.assessments.filter((assessment) => assessment.id !== Number.parseInt(assessmentId)),
          loading: false,
        }));
      } else {
        throw new Error(response.data.message);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || "Failed to delete assessment";
      set({ error: errorMessage, loading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  getEnrolledStudents: async (assessmentId) => {
    set({ loading: true, error: null });
    try {
      if (!assessmentId || isNaN(parseInt(assessmentId))) {
        throw new Error("Invalid assessment ID");
      }
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");
      const response = await axios.get(`${API_URL}/assessments/${parseInt(assessmentId)}/enrolled-students`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        set({ enrolledStudents: response.data.data, loading: false });
        return response.data.data;
      } else {
        throw new Error(response.data.message);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || "Failed to fetch enrolled students";
      set({ error: errorMessage, loading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  enrollStudent: async (assessmentId, email) => {
    set({ loading: true, error: null });
    try {
      if (!assessmentId || isNaN(parseInt(assessmentId))) {
        throw new Error("Invalid assessment ID");
      }
      if (!email || !email.trim()) {
        throw new Error("Student email is required and must be a valid string");
      }
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");
      const response = await axios.post(
        `${API_URL}/assessments/${parseInt(assessmentId)}/enroll`,
        { email: email.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        set((state) => ({
          enrolledStudents: [...state.enrolledStudents, response.data.data],
          loading: false,
        }));
        return response.data.data;
      } else {
        throw new Error(response.data.message);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || "Failed to enroll student";
      set({ error: errorMessage, loading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  unenrollStudent: async (assessmentId, studentId) => {
    set({ loading: true, error: null });
    try {
      if (!assessmentId || isNaN(parseInt(assessmentId))) {
        throw new Error("Invalid assessment ID");
      }
      if (!studentId || isNaN(parseInt(studentId))) {
        throw new Error("Invalid student ID");
      }
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");
      const response = await axios.delete(`${API_URL}/assessments/${parseInt(assessmentId)}/enroll/${parseInt(studentId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        set((state) => ({
          enrolledStudents: state.enrolledStudents.filter((student) => student.id !== Number.parseInt(studentId)),
          loading: false,
        }));
        return response.data.data;
      } else {
        throw new Error(response.data.message);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || "Failed to unenroll student";
      set({ error: errorMessage, loading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

    fetchPreviewQuestions: async (assessmentId) => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");
      const response = await axios.get(`${API_URL}/assessments/${assessmentId}/preview-questions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        set({ loading: false });
        return response.data.questions;
      } else {
        throw new Error(response.data.message);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || "Failed to generate preview questions";
      set({ error: errorMessage, loading: false });
      toast.error(errorMessage);
      throw error;
    }
  },
  

  clearError: () => {
    set({ error: null });
  },

  clearCurrentAssessment: () => {
    set({ currentAssessment: null });
  },
}));

export default useAssessmentStore;