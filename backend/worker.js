import { validateEnv } from "./config/env.js";

/**
 * Standalone background worker: `npm run worker`. Optional: the API runs the
 * jobs itself unless JOBS_IN_API=false (see jobs/runner.js). Use this to run
 * jobs on a separate machine or process.
 */
const start = async () => {
  try {
    validateEnv();
    const { startJobWorkers, stopJobWorkers } = await import("./jobs/index.js");
    await startJobWorkers();
    console.log("Gradix worker started");

    const shutdown = async (signal) => {
      console.log(`Worker received ${signal}; finishing current jobs…`);
      await stopJobWorkers();
      process.exit(0);
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error(`Worker failed to start: ${error.message}`);
    process.exit(1);
  }
};

start();
