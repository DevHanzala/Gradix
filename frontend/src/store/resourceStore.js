import { create } from "zustand";
import {
  fetchResourcesAPI,
  fetchAllResourcesAPI,
  getResourceByIdAPI,
  uploadResourcesAPI,
  deleteResourceAPI,
} from "../api/resource.api.js";

const useResourceStore = create((set) => ({
  resources: [],
  currentResource: null,
  loading: false,
  error: null,

  fetchResources: async () => {
    try {
      set({ loading: true, error: null });
      const res = await fetchResourcesAPI();
      set({ resources: res.data.data || [], loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  fetchAllResources: async () => {
    try {
      set({ loading: true, error: null });
      const res = await fetchAllResourcesAPI();
      set({ resources: res.data.data || [], loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  getResourceById: async (resourceId) => {
    try {
      set({ loading: true, error: null });
      const res = await getResourceByIdAPI(resourceId);
      set({ currentResource: res.data.data, loading: false });
      return res.data.data;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  uploadResources: async (files) => {
    try {
      set({ loading: true, error: null });
      const res = await uploadResourcesAPI(files);

      set({ loading: false });
      return res.data.resources || [];
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  deleteResource: async (resourceId) => {
    try {
      set({ loading: true, error: null });
      await deleteResourceAPI(resourceId);

      set((state) => ({
        resources: state.resources.filter(
          (r) => r.id !== resourceId
        ),
        loading: false,
      }));

    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  clearError: () => set({ error: null }),

  clearCurrentResource: () => set({ currentResource: null }),
}));

export default useResourceStore;
