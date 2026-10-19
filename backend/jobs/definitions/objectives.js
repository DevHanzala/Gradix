import { defineJob } from "../registry.js";
import { extractObjectivesJob } from "../../services/objectives.service.js";

// One extraction at a time per assessment (singletonKey "assessment-<id>").
defineJob("objectives.extract", extractObjectivesJob, { policy: "stately", retryLimit: 2 });
