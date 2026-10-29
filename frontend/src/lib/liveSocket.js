import { io } from "socket.io-client";

/** Socket.IO runs on the API's origin (VITE_API_URL without the /api path). */
const socketOrigin = () => {
  try {
    return new URL(import.meta.env.VITE_API_URL).origin;
  } catch {
    return window.location.origin;
  }
};

/**
 * Open a live-session socket. auth: { token } for a teacher or { liveToken } for a participant.
 * It reconnects by itself; screens refetch their state on every (re)connect.
 */
export const openLiveSocket = (auth) =>
  io(socketOrigin(), { auth, transports: ["websocket", "polling"], reconnectionDelayMax: 5000 });
