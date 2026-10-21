import apiClient from "../lib/apiClient.js";

export const fetchGroupsApi = () => apiClient.get("/groups");
export const createGroupApi = (body) => apiClient.post("/groups", body);
export const updateGroupApi = (id, body) => apiClient.put(`/groups/${id}`, body);
export const deleteGroupApi = (id) => apiClient.delete(`/groups/${id}`);
export const fetchGroupMembersApi = (id) => apiClient.get(`/groups/${id}/members`);
export const addGroupMembersApi = (id, emails) => apiClient.post(`/groups/${id}/members`, { emails });
export const removeGroupMemberApi = (id, userId) => apiClient.delete(`/groups/${id}/members/${userId}`);
export const enrollGroupApi = (assessmentId, groupId) => apiClient.post(`/assessments/${assessmentId}/enroll-group`, { groupId });
