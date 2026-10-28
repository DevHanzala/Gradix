import { validateEnv } from "./config/env.js";
import { connectDB } from "./DB/db.js";

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});

const startServer = async () => {
  try {
    validateEnv();
    // Import the app only after env validation so module-level config is safe.
    const { default: app } = await import("./app.js");
    await connectDB();

    const port = Number(process.env.PORT) || 5001;
    app.listen(port, "0.0.0.0", () => {
      console.log(`Gradix backend listening on port ${port}`);
    });

    // Background jobs (objectives, question pools…) run in this process unless
    // JOBS_IN_API=false, in which case `npm run worker` must be running.
    const { startJobWorkers, stopJobWorkers, jobsRunInApi } = await import("./jobs/index.js");
    if (jobsRunInApi()) {
      startJobWorkers().catch((error) => {
        console.error(`[jobs] could not start background jobs: ${error.message}. Objectives and question pools will not be generated until this is fixed.`);
      });
      const shutdown = async () => {
        await stopJobWorkers().catch(() => {});
        process.exit(0);
      };
      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    } else {
      console.log("[jobs] JOBS_IN_API=false: background jobs run in `npm run worker`.");
    }
  } catch (error) {
    console.error(`Startup failed: ${error.message}`);
    process.exit(1);
  }
};

startServer();
