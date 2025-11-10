import { create } from "zustand";
import axios from "axios";
import toast from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL || "https://gradeadmin.techmiresolutions.com/api";

const useResourceStore = create((set) => ({
  resources: [],
  currentResource: null,
  loading: false,
  error: null,

  fetchResources: async () => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_URL}/resources`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        set({ resources: response.data.data, loading: false });
      } else {
        set({ error: response.data.message, loading: false });
      }
    } catch (error) {
      set({ error: error.response?.data?.message || "Failed to fetch resources", loading: false });
      toast.error(error.response?.data?.message || "Failed to fetch resources");
    }
  },

  fetchAllResources: async () => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_URL}/resources/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        set({ resources: response.data.data, loading: false });
      } else {
        set({ error: response.data.message, loading: false });
      }
    } catch (error) {
      set({ error: error.response?.data?.message || "Failed to fetch system resources", loading: false });
      toast.error(error.response?.data?.message || "Failed to fetch system resources");
    }
  },

  getResourceById: async (resourceId) => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_URL}/resources/${resourceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        set({ currentResource: response.data.data, loading: false });
        return response.data.data;
      } else {
        throw new Error(response.data.message || "Failed to fetch resource");
      }
    } catch (error) {
      set({ error: error.response?.data?.message || "Failed to fetch resource", loading: false });
      toast.error(error.response?.data?.message || "Failed to fetch resource");
      throw error;
    }
  },

  uploadResources: async (files) => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      const response = await axios.post(`${API_URL}/resources`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      if (response.data.success) {
        set({ loading: false });
        return response.data.resources;
      } else {
        set({ error: response.data.message, loading: false });
      }
    } catch (error) {
      set({ error: error.response?.data?.message || "Failed to upload resources", loading: false });
      throw error;
    }
  },

  deleteResource: async (resourceId) => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      const response = await axios.delete(`${API_URL}/resources/${resourceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        set((state) => ({
          resources: state.resources.filter((resource) => resource.id !== resourceId),
          loading: false,
        }));
      } else {
        set({ error: response.data.message, loading: false });
      }
    } catch (error) {
      set({ error: error.response?.data?.message || "Failed to delete resource", loading: false });
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },

  clearCurrentResource: () => {
    set({ currentResource: null });
  },
}));

export default useResourceStore;