import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL;
  
const apiClient = axios.create({
  baseURL: API_BASE_URL,
});


/**
 * Attach token automatically (if present)
 */
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Handle 401 globally (except auth endpoints)
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const authFreeEndpoints = [
      "/auth/login",
      "/auth/signup",
      "/auth/google-auth",
      "/auth/verify",
      "/auth/forgot-password",
      "/auth/change-password",
    ];

    const isAuthFree = authFreeEndpoints.some((endpoint) =>
      error.config?.url?.includes(endpoint)
    );

    if (error.response?.status === 401 && !isAuthFree) {
      console.error("Unauthorized – logging out");
      localStorage.removeItem("token");
      localStorage.removeItem("auth-storage");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default apiClient;
