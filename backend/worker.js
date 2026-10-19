import { validateEnv } from "./config/env.js";

/**
 * Background worker: `npm run worker`. Runs every job registered in
 * jobs/index.js from the pg-boss queue in Postgres.
 */
const start = async () => {
  try {
    validateEnv();
    const { getBoss, stopBoss, listJobDefinitions } = await import("./jobs/index.js");
    const boss = await getBoss();
    const concurrency = Number(process.env.WORKER_CONCURRENCY) || 2;

    for (const def of listJobDefinitions()) {
      await boss.work(def.name, { batchSize: 1, localConcurrency: concurrency }, async ([job]) =>
        def.handler(job.data, {
          jobId: job.id,
          attempt: (job.retryCount ?? 0) + 1,
          maxAttempts: (def.options.retryLimit ?? 0) + 1,
        })
      );
    }
    await boss.schedule("maintenance.prune-llm-log", "30 3 * * *");
    // Bring resources from older chunking/embedding versions up to date.
    await boss.send("resources.rechunk-sweep", {}, { singletonKey: "sweep" });

    console.log(`Gradix worker running ${listJobDefinitions().length} job type(s), concurrency ${concurrency}`);

    const shutdown = async (signal) => {
      console.log(`Worker received ${signal}; finishing current jobs…`);
      await stopBoss();
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
