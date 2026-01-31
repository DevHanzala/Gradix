import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../config/firebase";

import {
  loginApi,
  signupApi,
  googleAuthApi,
  verifyEmailApi,
  forgotPasswordApi,
  changePasswordApi,
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
          const result = await signInWithPopup(auth, googleProvider);
          const firebaseUser = result.user;

          const response = await googleAuthApi({
            name: firebaseUser.displayName,
            email: firebaseUser.email,
            uid: firebaseUser.uid,
          });

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
          const { role, ...cleanedData } = studentData;
          const response = await registerStudentApi(cleanedData);
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

      changePassword: async (payload) => {
        try {
          const response = await changePasswordApi(payload);
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
