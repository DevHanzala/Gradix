import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import axios from "axios";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../config/firebase";

// Get the API base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Configure Axios defaults for all requests
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.headers.post["Content-Type"] = "application/json";

// Add a request interceptor to include the JWT token in headers for all requests
axios.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;

    // These endpoints do NOT require a token — suppress the warning
    const noTokenRequired =
      config.url.includes("/auth/login") ||
      config.url.includes("/auth/signup") ||
      config.url.includes("/auth/google-auth") ||
      config.url.includes("/auth/forgot-password") ||
      config.url.includes("/auth/verify") ||
      config.url.includes("/auth/change-password");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (!noTokenRequired) {
      // Only warn for protected routes
      console.warn(`⚠️ No token available for ${config.url}`);
    }

    return config;
  },
  (error) => Promise.reject(error)
);


// Add a response interceptor to handle token expiration or invalid tokens
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const isAuthEndpoint =
      error.config.url.includes("/auth/login") ||
      error.config.url.includes("/auth/signup") ||
      error.config.url.includes("/auth/google-auth") ||
      error.config.url.includes("/auth/verify") ||
      error.config.url.includes("/auth/forgot-password") ||
      error.config.url.includes("/auth/change-password");

    if (error.response && error.response.status === 401 && !isAuthEndpoint) {
      console.error(`❌ Unauthorized for ${error.config.url}: ${error.response.data.message || "Token invalid or expired"}`);
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);

// Define the Zustand store for authentication
const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      user: null,

      /**
       * Handles user login by making an API call and storing the token/user info.
       * @param {Object} credentials - Object containing user's email and password.
       * @returns {Promise<Object>} The user object on successful login.
       * @throws {Error} If login fails (e.g., network error, invalid credentials).
       */
      login: async (credentials) => {
        try {
          console.log(`🔍 Attempting login for email: ${credentials.email}`);
          const response = await axios.post("/auth/login", credentials);
          const { token, user } = response.data;
          console.log(`✅ Login successful: User=${user.email}, Role=${user.role}`);
          set({ token, user });
          return user;
        } catch (error) {
          console.error("❌ Login error:", error.response?.data || error);
          throw error.response?.data || error;
        }
      },

      /**
       * Handles Google authentication (signup/login).
       * @returns {Promise<Object>} The user object on successful authentication.
       * @throws {Error} If authentication fails.
       */
      googleAuth: async () => {
        try {
          console.log("🔄 Starting Google authentication...");
          const result = await signInWithPopup(auth, googleProvider);
          const firebaseUser = result.user;

          console.log("✅ Firebase Google auth successful:", {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName,
          });

          const response = await axios.post("/auth/google-auth", {
            name: firebaseUser.displayName,
            email: firebaseUser.email,
            uid: firebaseUser.uid,
          });

          const { token, user } = response.data;
          console.log("✅ Backend Google auth successful:", user);
          set({ token, user });
          return user;
        } catch (error) {
          console.error("❌ Google auth error:", error.response?.data || error);
          throw error.response?.data || error;
        }
      },

      /**
       * Handles user signup by making an API call.
       * @param {Object} userData - Object containing user's name, email, and password.
       * @returns {Promise<Object>} The response data on successful signup.
       * @throws {Error} If signup fails.
       */
      signup: async (userData) => {
        try {
          console.log(`🔍 Signing up user: ${userData.email}`);
          const response = await axios.post("/auth/signup", userData);
          console.log("✅ Signup successful:", userData.email);
          return response.data;
        } catch (error) {
          console.error("❌ Signup error:", error.response?.data || error);
          throw error.response?.data || error;
        }
      },

      /**
       * Handles student registration by admin/instructor.
       * @param {Object} studentData - Object containing student's name, email, and password.
       * @returns {Promise<Object>} The response data on successful registration.
       * @throws {Error} If registration fails.
       */
      registerStudent: async (studentData) => {
        try {
          const token = get().token;
          if (!token) {
            console.warn("⚠️ No token found in store for register-student");
            throw new Error("No authentication token found. Please log in again.");
          }
          // Strip any role field to prevent conflicts
          const { role, ...cleanedStudentData } = studentData;
          console.log("🔍 Registering student:", cleanedStudentData);
          const response = await axios.post("/auth/register-student", cleanedStudentData, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          console.log("✅ Student registered:", response.data.user);
          return response.data;
        } catch (error) {
          console.error("❌ Register student error:", error.response?.data || error);
          throw error.response?.data || error;
        }
      },

      /**
       * Handles email verification.
       * @param {string} token - The verification token.
       * @returns {Promise<Object>} The response data on successful verification.
       * @throws {Error} If verification fails.
       */
      verifyEmail: async (token) => {
        try {
          console.log(`🔍 Verifying email with token: ${token.slice(0, 10)}...`);
          const response = await axios.get(`/auth/verify/${token}`);
          console.log("✅ Email verified");
          return response.data;
        } catch (error) {
          console.error("❌ Verify email error:", error.response?.data || error);
          throw error.response?.data || error;
        }
      },

      /**
       * Handles forgot password request.
       * @param {Object} data - Object containing user's email.
       * @returns {Promise<Object>} The response data.
       * @throws {Error} If request fails.
       */
 forgotPassword: async (data) => {
  try {
    console.log(`🔍 Sending forgot password request for: ${data.email}`);

    const response = await axios.post("/auth/forgot-password", data);

    console.log("✅ Forgot password request sent");

    return response.data;
  } catch (error) {
    console.error("❌ Forgot password error:", error.response?.data || error);

    // Normalize the error structure so UI can always read: error.message
    throw {
      status: error.response?.status || 500,
      message:
        error.response?.data?.message ||
        "Failed to send reset link. Please try again.",
    };
  }
},



      /**
       * Handles password change for logged-in users or reset after forgot password.
       * @param {Object} data - Object containing currentPassword, newPassword, and optional resetId.
       * @returns {Promise<Object>} The response data.
       * @throws {Error} If change fails.
       */
      changePassword: async ({ currentPassword, newPassword, resetId }) => {
        try {
          console.log("🔍 Changing password", { resetId: !!resetId });
          const response = await axios.post("/auth/change-password", { currentPassword, newPassword, resetId });
          console.log("✅ Password changed");
          return response.data;
        } catch (error) {
          console.error("❌ Change password error:", error.response?.data || error);
          throw error.response?.data || error;
        }
      },

      /**
       * Gets all users (admin/super_admin only).
       * @returns {Promise<Object>} The response data containing users.
       * @throws {Error} If request fails.
       */
      getUsers: async () => {
        try {
          console.log("🔍 Fetching all users");
          const response = await axios.get("/auth/users");
          console.log(`✅ Fetched ${response.data.users.length} users`);
          return response.data;
        } catch (error) {
          console.error("❌ Get users error:", error.response?.data || error);
          throw error.response?.data || error;
        }
      },

      /**
       * Changes a user's role (admin/super_admin only).
       * @param {Object} data - Object containing userId, newRole, and userEmail.
       * @returns {Promise<Object>} The response data.
       * @throws {Error} If request fails.
       */
      changeUserRole: async (data) => {
        try {
          console.log("🔍 Changing user role:", data);
          const response = await axios.put("/auth/change-role", data);
          console.log("✅ User role changed:", data);
          return response.data;
        } catch (error) {
          console.error("❌ Change user role error:", error.response?.data || error);
          throw error.response?.data || error;
        }
      },

      /**
       * Deletes a user (super_admin only).
       * @param {number} userId - The user ID to delete.
       * @returns {Promise<Object>} The response data.
       * @throws {Error} If request fails.
       */
      deleteUser: async (userId) => {
        try {
          console.log(`🔍 Deleting user: ${userId}`);
          const response = await axios.delete(`/auth/users/${userId}`);
          console.log("✅ User deleted:", userId);
          return response.data;
        } catch (error) {
          console.error("❌ Delete user error:", error.response?.data || error);
          throw error.response?.data || error;
        }
      },

      /**
       * Logs out a user by clearing the token and user information from the store.
       */
      logout: () => {
        console.log("🔄 Logging out user");
        set({ token: null, user: null });
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export default useAuthStore;