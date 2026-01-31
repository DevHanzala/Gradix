import apiClient from "../lib/apiClient.js";

export const fetchResourcesAPI = () =>
  apiClient.get("/resources");

export const fetchAllResourcesAPI = () =>
  apiClient.get("/resources/all");

export const getResourceByIdAPI = (resourceId) =>
  apiClient.get(`/resources/${resourceId}`);

export const uploadResourcesAPI = (files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  return apiClient.post("/resources", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

export const deleteResourceAPI = (resourceId) =>
  apiClient.delete(`/resources/${resourceId}`);
