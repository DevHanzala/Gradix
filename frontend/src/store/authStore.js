import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import {
  loginApi,
  signupApi,
  googleAuthApi,
  verifyEmailApi,
  forgotPasswordApi,
  changePasswordApi,
  resetPasswordApi,
  resendVerificationApi,
  registerStudentApi,
  fetchUsersApi,
  changeUserRoleApi,
  deleteUserApi,
} from "../api/auth.api";

const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      user: null,

      /* =========================
         Login
      ========================= */

      login: async (credentials) => {
        try {
          const response = await loginApi(credentials);
          const { token, user } = response.data;
          set({ token, user });
          localStorage.setItem("token", token);
          return user;
        } catch (error) {
          throw error.response?.data || error;
        }
      },

      /* =========================
         Google Auth
      ========================= */

      googleAuth: async () => {
        try {
          // Firebase is loaded only when Google sign-in is used (keeps it out of the main bundle).
          const [{ signInWithPopup }, { auth, googleProvider }] = await Promise.all([
            import("firebase/auth"),
            import("../config/firebase"),
          ]);
          const result = await signInWithPopup(auth, googleProvider);
          // The backend verifies this token with Firebase Admin and derives
          // the user's identity from it; nothing else is trusted.
          const idToken = await result.user.getIdToken();

          const response = await googleAuthApi({ idToken });

          const { token, user } = response.data;
          set({ token, user });
          localStorage.setItem("token", token);
          return user;
        } catch (error) {
          throw error.response?.data || error;
        }
      },

      /* =========================
         Signup
      ========================= */

      signup: async (data) => {
        try {
          const response = await signupApi(data);
          return response.data;
        } catch (error) {
          throw error.response?.data || error;
        }
      },

      /* =========================
         Student Registration
      ========================= */

      registerStudent: async (studentData) => {
        try {
          // New accounts are always students; never forward a role field.
          const { name, email, password } = studentData;
          const response = await registerStudentApi({ name, email, password });
          return response.data;
        } catch (error) {
          throw error.response?.data || error;
        }
      },

      /* =========================
         Email / Password
      ========================= */

      verifyEmail: async (token) => {
        try {
          const response = await verifyEmailApi(token);
          return response.data;
        } catch (error) {
          throw error.response?.data || error;
        }
      },

      forgotPassword: async (data) => {
        try {
          const response = await forgotPasswordApi(data);
          return response.data;
        } catch (error) {
          throw {
            status: error.response?.status || 500,
            message:
              error.response?.data?.message ||
              "Failed to send reset link",
          };
        }
      },

      // Logged-in user: requires the current password.
      changePassword: async ({ currentPassword, newPassword }) => {
        try {
          const response = await changePasswordApi({ currentPassword, newPassword });
          return response.data;
        } catch (error) {
          throw error.response?.data || error;
        }
      },

      // From the emailed reset link.
      resetPassword: async ({ resetId, newPassword }) => {
        try {
          const response = await resetPasswordApi({ resetId, newPassword });
          return response.data;
        } catch (error) {
          throw error.response?.data || error;
        }
      },

      resendVerification: async (email) => {
        try {
          const response = await resendVerificationApi(email);
          return response.data;
        } catch (error) {
          throw error.response?.data || error;
        }
      },

      /* =========================
         Admin
      ========================= */

      getUsers: async () => {
        try {
          const response = await fetchUsersApi();
          return response.data;
        } catch (error) {
          throw error.response?.data || error;
        }
      },

      changeUserRole: async (data) => {
        try {
          const response = await changeUserRoleApi(data);
          return response.data;
        } catch (error) {
          throw error.response?.data || error;
        }
      },

      deleteUser: async (userId) => {
        try {
          const response = await deleteUserApi(userId);
          return response.data;
        } catch (error) {
          throw error.response?.data || error;
        }
      },

      /* =========================
         Logout
      ========================= */

      logout: () => {
        localStorage.removeItem("token");
        set({ token: null, user: null });
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useAuthStore;
