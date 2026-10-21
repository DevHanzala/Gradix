import apiClient from "../lib/apiClient.js";

export const fetchPlatformStatsApi = (days = 30) => apiClient.get("/admin/stats", { params: { days } });
