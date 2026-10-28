import db from "../DB/db.js";
import { enqueue, getBoss, stopBoss } from "./queue.js";
import { listJobDefinitions } from "./registry.js";

/**
 * Runs the background jobs (objectives, question pools, re-chunking, housekeeping).
 *
 * By default the API process runs them itself (JOBS_IN_API is not "false"), so a
 * single `npm start` is a complete server. For larger deployments run
 * `npm run worker` separately and set JOBS_IN_API=false on the API.
 *
 * Work interrupted by a restart or a crashed job is picked up again: on start and
 * every few minutes, assessments still "extracting" objectives and languages still
 * "filling" their pool are re-queued. The jobs are idempotent and de-duplicated
 * per assessment (stately queues), so re-queueing never doubles the work.
 */
export const STALE_AFTER_MINUTES = 5;
const WATCHDOG_MS = 5 * 60 * 1000;

export const jobsRunInApi = () => String(process.env.JOBS_IN_API ?? "true").toLowerCase() !== "false";

/** Re-queue work that should be running but may have been lost. Returns what was re-queued. */
export const recoverStuckWork = async ({ olderThanMinutes = 0 } = {}) => {
  const { rows: assessments } = await db.query(
    `SELECT id FROM assessments
     WHERE objectives_state = 'extracting' AND updated_at <= NOW() - make_interval(mins => $1)`,
    [olderThanMinutes]
  );
  for (const { id } of assessments) {
    await enqueue("objectives.extract", { assessmentId: id }, { singletonKey: `assessment-${id}` });
  }
  const { rows: pools } = await db.query(
    `SELECT assessment_id, language FROM pool_language_state
     WHERE state = 'filling' AND updated_at <= NOW() - make_interval(mins => $1)`,
    [olderThanMinutes]
  );
  for (const { assessment_id: assessmentId, language } of pools) {
    await enqueue("pool.fill", { assessmentId, language }, { singletonKey: `pool-${assessmentId}-${language}` });
  }
  return { objectives: assessments.map((a) => a.id), pools: pools.map((p) => `${p.assessment_id}/${p.language}`) };
};

let watchdog = null;

export const startJobWorkers = async ({ concurrency = Number(process.env.WORKER_CONCURRENCY) || 2 } = {}) => {
  const boss = await getBoss();
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

  const recover = async (olderThanMinutes) => {
    try {
      const recovered = await recoverStuckWork({ olderThanMinutes });
      if (recovered.objectives.length || recovered.pools.length) {
        console.log(`[jobs] re-queued objectives for ${JSON.stringify(recovered.objectives)}, pools ${JSON.stringify(recovered.pools)}`);
      }
    } catch (error) {
      console.error(`[jobs] recovery failed: ${error.message}`);
    }
  };
  await recover(0);
  watchdog = setInterval(() => recover(STALE_AFTER_MINUTES), WATCHDOG_MS);
  watchdog.unref?.();

  console.log(`[jobs] running ${listJobDefinitions().length} job type(s), concurrency ${concurrency}`);
  return boss;
};

export const stopJobWorkers = async () => {
  if (watchdog) clearInterval(watchdog);
  watchdog = null;
  await stopBoss();
};
