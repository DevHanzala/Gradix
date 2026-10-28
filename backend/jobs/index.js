// Importing this module registers every background job.
// Add new job modules here so both the API (enqueue) and the worker see them.
import "./definitions/maintenance.js";
import "./definitions/resources.js";
import "./definitions/objectives.js";
import "./definitions/pool.js";

export { enqueue, queueAdapter, getBoss, stopBoss } from "./queue.js";
export { defineJob, listJobDefinitions } from "./registry.js";
export { startJobWorkers, stopJobWorkers, recoverStuckWork, jobsRunInApi } from "./runner.js";
