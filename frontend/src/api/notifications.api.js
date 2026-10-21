import apiClient from "../lib/apiClient.js";

export const fetchNotificationsApi = () => apiClient.get("/notifications");
export const markNotificationReadApi = (id) => apiClient.post(`/notifications/${id}/read`);
export const markAllNotificationsReadApi = () => apiClient.post("/notifications/read-all");
