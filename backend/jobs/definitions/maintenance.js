import db from "../../DB/db.js";
import { defineJob } from "../registry.js";

/**
 * Housekeeping: delete LLM usage rows older than the retention window.
 * Idempotent by nature (a second run deletes nothing new).
 */
export const LLM_LOG_RETENTION_DAYS = Number(process.env.LLM_LOG_RETENTION_DAYS) || 365;

defineJob(
  "maintenance.prune-llm-log",
  async () => {
    const { rowCount } = await db.query(
      `DELETE FROM llm_usage_log WHERE created_at < NOW() - make_interval(days => $1)`,
      [LLM_LOG_RETENTION_DAYS]
    );
    return { deleted: rowCount };
  },
  { retryLimit: 2 }
);
