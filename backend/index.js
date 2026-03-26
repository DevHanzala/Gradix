import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./DB/db.js";
import authRoutes from "./routes/authRoutes.js";
import assessmentRoutes from "./routes/assessmentRoutes.js";
import resourceRoutes from "./routes/resourceRoutes.js";
import studentAnalyticsRoutes from "./routes/studentAnalyticsRoutes.js";
import studentAssessmentRoutes from "./routes/studentAssessmentRoutes.js";
import instructorAssessmentAnalyticsRoutes from "./routes/instructorAssessmentAnalyticsRoutes.js";

import { errorHandler, notFound } from "./middleware/errorMiddleware.js";

// Load environment variables
dotenv.config();

/* =========================
   LOGGER
========================= */
class Logger {
  constructor() {
    this.startupLogs = [];
    this.recentErrors = [];
    this.maxErrors = 10;
  }

  log(message) {
    const logEntry = `[${new Date().toISOString()}] ${message}`;
    console.log(logEntry);
    this.startupLogs.push(logEntry);
  }

  error(message, error) {
    console.error(message, error);
    this.recentErrors.push({
      message,
      error: error?.message || String(error),
      stack: error?.stack,
      time: new Date().toISOString(),
    });

    if (this.recentErrors.length > this.maxErrors) {
      this.recentErrors = this.recentErrors.slice(-this.maxErrors);
    }
  }
}

const logger = new Logger();

/* =========================
   ENV VALIDATION
========================= */
const validateEnv = () => {
  const required = [
    "GEMINI_CREATION_API_KEY_1",
    "GEMINI_CHECKING_API_KEY",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  logger.log("✓ Environment variables validated");
};

/* =========================
   APP SETUP
========================= */
const app = express();
app.disable("x-powered-by");

const PORT = process.env.PORT;
let dbConnected = false;

/* =========================
   MIDDLEWARE
========================= */
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging
app.use((req, res, next) => {
  logger.log(`${req.method} ${req.originalUrl}`);
  next();
});

/* =========================
   ROUTES
========================= */
app.use("/api/auth", authRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/api/student-analytics", studentAnalyticsRoutes);
app.use("/api/taking", studentAssessmentRoutes);
app.use("/api/instructor-analytics", instructorAssessmentAnalyticsRoutes);

/* =========================
   HEALTH CHECK
========================= */
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Gradewise AI Backend is running!",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0",
    database: dbConnected ? "connected" : "disconnected",
  });
});

/* =========================
   DEBUG LOGS (DEV ONLY)
========================= */
app.get("/api/logs", (req, res) => {
  res.json({
    success: true,
    data: {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      port: PORT,
      dbConnected,
      uptime: `${process.uptime().toFixed(2)} seconds`,
      startupLogs: logger.startupLogs,
      recentErrors: logger.recentErrors,
    },
  });
});

/* =========================
   ROOT
========================= */
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to Gradewise AI Backend",
    health: "/api/health",
    docs: "Use /api/* for all endpoints",
    developer: "Hanzala Ghani",
  });
});

/* =========================
   ERROR HANDLING
========================= */
app.use(notFound);
app.use(errorHandler);

/* =========================
   PROCESS SAFETY
========================= */
process.on("unhandledRejection", (err) => {
  logger.error("UNHANDLED REJECTION:", err);
  if (process.env.NODE_ENV === "production") {
    setTimeout(() => process.exit(1), 1000);
  }
});

process.on("uncaughtException", (err) => {
  logger.error("UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});

/* =========================
   SERVER START
========================= */
const startServer = async () => {
  try {
    logger.log(`Starting server on port ${PORT}...`);
    logger.log(
      `Frontend URL: ${process.env.FRONTEND_URL}`
    );

    validateEnv();

    await connectDB();
    dbConnected = true;
    logger.log("✓ Database connected successfully");

    app.listen(PORT, "0.0.0.0", () => {
      logger.log(`✓ Server is LIVE at http://localhost:5000`);
      logger.log(`Health check: http://localhost:5173/api/health`);
    });
  } catch (error) {
    logger.error("FATAL: Startup failed", error);
    process.exit(1);
  }
};

startServer();

export default app;
