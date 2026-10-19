// Importing this module registers every background job.
// Add new job modules here so both the API (enqueue) and the worker see them.
import "./definitions/maintenance.js";
import "./definitions/resources.js";
import "./definitions/objectives.js";

export { enqueue, queueAdapter, getBoss, stopBoss } from "./queue.js";
export { defineJob, listJobDefinitions } from "./registry.js";
