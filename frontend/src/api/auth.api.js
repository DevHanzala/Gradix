import apiClient from "../lib/apiClient";

/* =========================
   Auth
========================= */

export const loginApi = (credentials) =>
  apiClient.post("/auth/login", credentials);

export const signupApi = (data) =>
  apiClient.post("/auth/signup", data);

export const googleAuthApi = (payload) =>
  apiClient.post("/auth/google-auth", payload);

export const verifyEmailApi = (token) =>
  apiClient.get(`/auth/verify/${token}`);

export const forgotPasswordApi = (data) =>
  apiClient.post("/auth/forgot-password", data);

export const changePasswordApi = (data) =>
  apiClient.post("/auth/change-password", data);

/* =========================
   Admin / Instructor
========================= */

export const registerStudentApi = (data) =>
  apiClient.post("/auth/register-student", data);

export const fetchUsersApi = () =>
  apiClient.get("/auth/users");

export const changeUserRoleApi = (data) =>
  apiClient.put("/auth/change-role", data);

export const deleteUserApi = (userId) =>
  apiClient.delete(`/auth/users/${userId}`);
