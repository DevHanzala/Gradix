import { validateEnv } from "./config/env.js";
import db, { connectDB } from "./DB/db.js";

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});

/**
 * Start fast (Render cold starts): nothing heavy is loaded here. The embedding model,
 * Chromium, Tesseract and the Office/PDF parsers load on first use only.
 */
const startServer = async () => {
  try {
    validateEnv();
    const { initMonitoring, flushMonitoring } = await import("./services/monitoring.js");
    await initMonitoring();
    // Import the app only after env validation so module-level config is safe.
    const { default: app } = await import("./app.js");
    await connectDB();

    const port = Number(process.env.PORT) || 5001;
    const { createServer } = await import("http");
    const server = createServer(app);
    // Live sessions push updates over Socket.IO on the same port (works through Render's proxy).
    const { attachRealtime, closeRealtime } = await import("./services/live/realtime.js");
    await attachRealtime(server);
    server.listen(port, "0.0.0.0", () => {
      console.log(`Gradix backend listening on port ${port}`);
    });

    // Background jobs (objectives, question pools...) run in this process unless
    // RUN_WORKER_IN_PROCESS=false (or JOBS_IN_API=false), in which case `npm run worker` must run.
    const { startJobWorkers, stopJobWorkers, jobsRunInApi } = await import("./jobs/index.js");
    if (jobsRunInApi()) {
      startJobWorkers().catch((error) => {
        console.error(`[jobs] could not start background jobs: ${error.message}. Objectives and question pools will not be generated until this is fixed.`);
      });
    } else {
      console.log("[jobs] RUN_WORKER_IN_PROCESS=false: background jobs run in `npm run worker`.");
    }

    // Graceful shutdown (Render sends SIGTERM on deploys and before sleeping): stop taking
    // requests, let running ones finish, stop the job workers (unfinished jobs stay in
    // Postgres and resume on the next start), close sockets and the database pool.
    let stopping = false;
    const shutdown = async (signal) => {
      if (stopping) return;
      stopping = true;
      console.log(`[shutdown] ${signal}: closing`);
      const force = setTimeout(() => process.exit(0), 25000);
      force.unref();
      await new Promise((resolve) => server.close(() => resolve()));
      await closeRealtime().catch(() => {});
      if (jobsRunInApi()) await stopJobWorkers().catch(() => {});
      await flushMonitoring();
      await db.end().catch(() => {});
      process.exit(0);
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error(`Startup failed: ${error.message}`);
    process.exit(1);
  }
};

startServer();
