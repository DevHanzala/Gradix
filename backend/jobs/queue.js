import { PgBoss } from "pg-boss";
import { getJobDefinition, listJobDefinitions } from "./registry.js";

/**
 * Background jobs (pg-boss on the app's Postgres; no Redis).
 *
 * Modes:
 *  - "pgboss": jobs go to the database queue and are run by `npm run worker`.
 *  - "inline": jobs run immediately in-process with the same retry rules
 *              (used by tests so pipelines are deterministic).
 *  - "record": jobs are only recorded in `queueAdapter.recorded` (tests that
 *              assert what was enqueued without running it).
 */
export const queueAdapter = {
  mode: process.env.NODE_ENV === "test" ? "inline" : "pgboss",
  recorded: [],
};

let bossPromise = null;

const connectionOptions = () => ({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: true },
  schema: "pgboss",
  application_name: "gradix",
  max: Number(process.env.JOB_POOL_MAX) || 4,
});

/** Create (if needed) a queue for every registered job, with its retry policy. */
const ensureQueues = async (boss) => {
  for (const def of listJobDefinitions()) {
    const existing = await boss.getQueue(def.name);
    if (!existing) await boss.createQueue(def.name, def.options);
  }
};

/** Lazily start pg-boss (shared by the API process and the worker). */
export const getBoss = () => {
  if (!bossPromise) {
    bossPromise = (async () => {
      const boss = new PgBoss(connectionOptions());
      boss.on("error", (error) => console.error(`[jobs] ${error.message}`));
      await boss.start();
      await ensureQueues(boss);
      return boss;
    })().catch((error) => {
      bossPromise = null;
      throw error;
    });
  }
  return bossPromise;
};

export const stopBoss = async () => {
  if (!bossPromise) return;
  const boss = await bossPromise.catch(() => null);
  bossPromise = null;
  await boss?.stop({ graceful: true, timeout: 20000 });
};

/** Run a handler in-process, retrying like pg-boss would (without the delays). */
const runInline = async (def, data) => {
  const attempts = (def.options.retryLimit ?? 0) + 1;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await def.handler(data, { jobId: `inline-${Date.now()}`, attempt, maxAttempts: attempts });
    } catch (error) {
      lastError = error;
    }
  }
  console.error(`[jobs] ${def.name} failed after ${attempts} attempts: ${lastError?.message}`);
  return undefined;
};

/**
 * Enqueue a job. `singletonKey` de-duplicates: while a job with the same name
 * and key is queued, another one is not added (pg-boss) — use it for
 * "rebuild X for assessment N" style jobs.
 */
export const enqueue = async (name, data = {}, { singletonKey, startAfter } = {}) => {
  const def = getJobDefinition(name);
  if (!def) throw new Error(`Unknown job: ${name}`);
  if (def.options.policy === "stately" && !singletonKey) {
    // Without a key every job would share one slot and silently be dropped.
    throw new Error(`Job ${name} uses the stately policy and needs a singletonKey`);
  }

  if (queueAdapter.mode === "record") {
    queueAdapter.recorded.push({ name, data, singletonKey });
    return `recorded-${queueAdapter.recorded.length}`;
  }
  if (queueAdapter.mode === "inline") {
    await runInline(def, data);
    return `inline-${name}`;
  }

  const boss = await getBoss();
  return boss.send(name, data, {
    ...(singletonKey ? { singletonKey } : {}),
    ...(startAfter ? { startAfter } : {}),
  });
};
