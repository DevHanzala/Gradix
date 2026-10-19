import { defineJob } from "../registry.js";
import { fillPoolJob } from "../../services/pool/pool.service.js";

// One fill at a time per assessment + language (singletonKey "pool-<id>-<lang>").
defineJob("pool.fill", fillPoolJob, { policy: "stately", retryLimit: 4 });
