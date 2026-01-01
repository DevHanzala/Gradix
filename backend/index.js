// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import { connectDB } from "./DB/db.js";
import { init as initAssessmentModel } from "./models/assessmentModel.js";
import { init as initResourceModel } from "./models/resourceModel.js";
import authRoutes from "./routes/authRoutes.js";
import assessmentRoutes from "./routes/assessmentRoutes.js";
import resourceRoutes from "./routes/resourceRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import studentAnalyticsRoutes from "./routes/studentAnalyticsRoutes.js";
import takingRoutes from "./routes/takingRoutes.js";
import instructorAssessmentAnalyticsRoutes from "./routes/instructorAssessmentAnalyticsRoutes.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";

// === GLOBALS FOR LOGGING (MochaHost Debug) ===
global.startupLogs = [];
global.recentErrors = [];
global.dbConnected = false;

// FIXED: .env loading
dotenv.config();


console.log("GEMINI_CREATION_API_KEY_1 loaded:", process.env.GEMINI_CREATION_API_KEY_1 ? "Yes" : "No");
console.log("GEMINI_CREATION_API_KEY_2 loaded:", process.env.GEMINI_CREATION_API_KEY_2 ? "Yes" : "No");
console.log("GROQ_API_KEY loaded:", process.env.GROQ_API_KEY ? "Yes" : "No");
console.log("CHECKING_API_KEY loaded:", process.env.GEMINI_CHECKING_API_KEY ? "Yes" : "No");


const app = express();
app.disable("x-powered-by");
const PORT = process.env.PORT || 5000;

// HTTP + Socket.IO Server
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  },
});

app.set("io", io);

// Track upload sockets
const uploadSockets = new Map();

io.on("connection", (socket) => {
  console.log(`WebSocket connected: ${socket.id}`);

  socket.on("register-upload", (userId) => {
    uploadSockets.set(socket.id, userId);
    console.log(`Upload socket registered: ${socket.id} → user ${userId}`);
  });

  socket.on("disconnect", () => {
    uploadSockets.delete(socket.id);
    console.log(`WebSocket disconnected: ${socket.id}`);
  });
});

// === START SERVER WITH LOGGING ===
const startServer = async () => {
  try {
    global.startupLogs.push(`[INIT] Starting server on port ${PORT}...`);
    global.startupLogs.push(`[ENV] NODE_ENV = ${process.env.NODE_ENV || "development"}`);
    global.startupLogs.push(`[ENV] FRONTEND_URL = ${process.env.FRONTEND_URL || "http://localhost:5173"}`);

    global.startupLogs.push("[DB] Connecting to database...");
    await connectDB();
    global.dbConnected = true;
    global.startupLogs.push("[DB] Connected successfully!");

    global.startupLogs.push("[MODEL] Initializing Resource Model...");
    await initResourceModel();
    global.startupLogs.push("[MODEL] Resource Model initialized!");

    global.startupLogs.push("[MODEL] Initializing Assessment Model...");
    await initAssessmentModel();
    global.startupLogs.push("[MODEL] Assessment Model initialized!");

    global.startupLogs.push(`[SERVER] Listening on 0.0.0.0:${PORT}...`);

    httpServer.listen(PORT, "0.0.0.0", () => {
      global.startupLogs.push(`[LIVE] Server is LIVE at http://0.0.0.0:${PORT}`);
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:5173"}`);
      console.log(`Health: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    const msg = `[FATAL] STARTUP FAILED: ${error.message}`;
    console.error(msg);
    global.startupLogs.push(msg);
    global.recentErrors.push({
      error: error.message,
      stack: error.stack,
      time: new Date().toISOString(),
    });
    process.exit(1);
  }
};

// === MIDDLEWARE ===
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl} - ${new Date().toISOString()}`);
  next();
});

// === ROUTES ===
app.use("/api/auth", authRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/student-analytics", studentAnalyticsRoutes);
app.use("/api/taking", takingRoutes);
app.use("/api/instructor-analytics", instructorAssessmentAnalyticsRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Gradewise AI Backend is running!",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0",
  });
});

// === DEBUG LOGS ENDPOINT (MochaHost) ===
app.get("/api/logs", (req, res) => {
  res.json({
    success: true,
    data: {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      port: PORT,
      frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
      geminiKeyLoaded: !!process.env.GEMINI_CREATION_API_KEY,
      dbConnected: global.dbConnected,
      uptime: `${process.uptime().toFixed(2)} seconds`,
      startupLogs: global.startupLogs,
      recentErrors: global.recentErrors.slice(-10), // Last 10 errors
    },
  });
});

// Root welcome
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to Gradewise AI Backend",
    health: "/api/health",
    logs: "/api/logs",
    docs: "Use /api/* for all endpoints",
  });
});

// 404 & Error (must be last)
app.use(notFound);
app.use(errorHandler);

// === ENHANCED ERROR LOGGING ===
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err?.message || err);
  global.recentErrors.push({
    error: err?.message || String(err),
    stack: err?.stack,
    time: new Date().toISOString(),
  });
});

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err.message);
  global.recentErrors.push({
    error: err.message,
    stack: err.stack,
    time: new Date().toISOString(),
  });
});




// === START ===
startServer();

export default app;