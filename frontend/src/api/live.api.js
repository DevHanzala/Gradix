import apiClient from "../lib/apiClient.js";

/* Teacher */
export const createLiveSessionApi = (body) => apiClient.post("/live/sessions", body);
export const fetchLiveSessionsApi = () => apiClient.get("/live/sessions");
export const fetchLiveSessionApi = (id) => apiClient.get(`/live/sessions/${id}`);
export const controlLiveSessionApi = (id, action) => apiClient.post(`/live/sessions/${id}/control`, { action });
export const removeLiveParticipantApi = (id, participantId) => apiClient.delete(`/live/sessions/${id}/participants/${participantId}`);
export const exportLiveCsvApi = (id) => apiClient.get(`/live/sessions/${id}/export.csv`, { responseType: "blob" });

/* Participant (the X-Live-Token from joining identifies them; guests have no login) */
const withToken = (token) => ({ headers: { "X-Live-Token": token } });
export const lookupLiveCodeApi = (code) => apiClient.get(`/live/join/${encodeURIComponent(code)}`);
export const joinLiveApi = (code, nickname) => apiClient.post("/live/join", { code, nickname });
export const fetchLiveMeApi = (token) => apiClient.get("/live/me", withToken(token));
export const answerLiveApi = (token, index, answer) => apiClient.post("/live/me/answer", { index, answer }, withToken(token));
export const nextLiveApi = (token) => apiClient.post("/live/me/next", {}, withToken(token));

/* Polls, exit tickets and teams */
export const openPollApi = (id, body) => apiClient.post(`/live/sessions/${id}/polls`, body);
export const closePollApi = (id, pollId) => apiClient.post(`/live/sessions/${id}/polls/${pollId}/close`);
export const setTeamApi = (id, participantId, team) => apiClient.put(`/live/sessions/${id}/participants/${participantId}/team`, { team });
export const respondPollApi = (token, pollId, answer) => apiClient.post("/live/me/poll", { pollId, answer }, withToken(token));
