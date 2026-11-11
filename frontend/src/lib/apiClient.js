import axios from "axios";
import { requestStarted, requestFinished, isWakeError, markWaking, WAKE_RETRY } from "./serverWake.js";

const API_BASE_URL =
  import.meta.env.VITE_API_URL;
  
const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Waking-up detection and retry while the free-tier server starts (see serverWake.js).
apiClient.interceptors.request.use((config) => {
  requestStarted();
  return config;
});
apiClient.interceptors.response.use(
  (response) => {
    requestFinished();
    return response;
  },
  async (error) => {
    requestFinished();
    const config = error.config;
    // Retry when the server is not up yet. Only GETs, or any request that never reached it.
    const safe = config && (config.method === "get" || !error.response);
    if (safe && isWakeError(error) && (config.__wakeRetries || 0) < WAKE_RETRY.attempts) {
      config.__wakeRetries = (config.__wakeRetries || 0) + 1;
      markWaking();
      await new Promise((r) => setTimeout(r, WAKE_RETRY.delayMs));
      return apiClient(config);
    }
    return Promise.reject(error);
  }
);


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
      "/auth/reset-password",
      "/auth/resend-verification",
      // Live-session participants (often guests) are not logged in; a 401 there means "join again".
      "/live/me",
      "/live/join",
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
