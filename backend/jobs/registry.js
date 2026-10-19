/**
 * Job registry. Each job module calls `defineJob` at import time; the worker
 * registers every definition with pg-boss, and tests can run them inline.
 *
 * Handlers MUST be idempotent: a job can run more than once (retries, a
 * worker crash after the work but before completion). Re-check state in the
 * database instead of assuming this is the first run.
 *
 * De-duplication: pg-boss only de-duplicates by `singletonKey` when the queue
 * policy is "stately" (at most one queued + one active job per key). Use
 * `{ policy: "stately" }` for "rebuild X for assessment N" jobs and always
 * enqueue them with a singletonKey (enforced by enqueue()).
 */

/** Retry policy shared by all jobs unless a job overrides it. */
export const DEFAULT_JOB_OPTIONS = {
  retryLimit: 4,
  retryDelay: 15, // seconds; with backoff: ~15s, 30s, 60s, 120s
  retryBackoff: true,
  retryDelayMax: 600,
  expireInSeconds: 15 * 60, // a single LLM-heavy job may take minutes
};

const definitions = new Map();

/**
 * @param {string} name        queue name, e.g. "objectives.extract"
 * @param {(data: object, ctx: {jobId: string, attempt: number, maxAttempts: number}) => Promise<any>} handler
 * @param {object} [options]   pg-boss queue options (retryLimit, retryDelay, ...)
 */
export const defineJob = (name, handler, options = {}) => {
  definitions.set(name, { name, handler, options: { ...DEFAULT_JOB_OPTIONS, ...options } });
};

export const getJobDefinition = (name) => definitions.get(name);
export const listJobDefinitions = () => [...definitions.values()];
