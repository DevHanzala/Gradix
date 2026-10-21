import apiClient from "../lib/apiClient.js";

export const fetchResourcesAPI = () =>
  apiClient.get("/resources");

export const fetchAllResourcesAPI = () =>
  apiClient.get("/resources/all");

export const getResourceByIdAPI = (resourceId) =>
  apiClient.get(`/resources/${resourceId}`);

export const uploadResourcesAPI = (files, { visibility = "private" } = {}) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  formData.append("visibility", visibility);
  return apiClient.post("/resources", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const deleteResourceAPI = (resourceId) =>
  apiClient.delete(`/resources/${resourceId}`);

/** Library search with filters and pagination (no full text returned). */
export const searchResourcesAPI = (params) => apiClient.get("/resources/search", { params });

/** Add a web page or YouTube video as a resource (the server reads it). */
export const addLinkResourceAPI = (url, { visibility = "private", name } = {}) => {
  const formData = new FormData();
  formData.append("url", url);
  formData.append("visibility", visibility);
  if (name) formData.append("name", name);
  return apiClient.post("/resources", formData, { headers: { "Content-Type": "multipart/form-data" } });
};
