import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/authRoutes.js";
import assessmentRoutes from "./routes/assessmentRoutes.js";
import resourceRoutes from "./routes/resourceRoutes.js";
import studentAnalyticsRoutes from "./routes/studentAnalyticsRoutes.js";
import studentAssessmentRoutes from "./routes/studentAssessmentRoutes.js";
import instructorAssessmentAnalyticsRoutes from "./routes/instructorAssessmentAnalyticsRoutes.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";

/**
 * Builds the Express app without connecting to the database or listening,
 * so tests can import it directly.
 */
const app = express();
app.disable("x-powered-by");

// Behind a reverse proxy (Render, Railway, Nginx) set TRUST_PROXY=1 so rate
// limits see the real client IP.
if (process.env.TRUST_PROXY) {
  app.set("trust proxy", Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}

app.use(
  helmet({
    // The API is called cross-origin by the SPA (CORS handles access control).
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/api/student-analytics", studentAnalyticsRoutes);
app.use("/api/taking", studentAssessmentRoutes);
app.use("/api/instructor-analytics", instructorAssessmentAnalyticsRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Gradix backend is running",
    timestamp: new Date().toISOString(),
  });
});

app.use(notFound);
app.use(errorHandler);

export default app;
