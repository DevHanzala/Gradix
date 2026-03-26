// src/hooks/useAssessmentSocket.js
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export default function useAssessmentSocket() {
  const socketRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL;
    const socket = io(API_URL, {
      transports: ["websocket"],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("assessment-progress", (data) => {
      setProgress(data.percent);
      setProgressMessage(data.message);
    });

    return () => socket.disconnect();
  }, []);

  return {
    socketId: socketRef.current?.id,
    progress,
    progressMessage,
  };
}
