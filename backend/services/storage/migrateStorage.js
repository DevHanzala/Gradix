import db from "../../DB/db.js";
import { storage, localDriver, storageDriverName } from "../../helper/storage.js";
import { reportStorageKey } from "../learning/report.service.js";

/**
 * Move existing files into the configured storage and update references:
 *  1. PDF reports cached in Postgres (learning_reports.pdf BYTEA) -> storage,
 *     setting pdf_storage_key and clearing the BYTEA column;
 *  2. with copyLocal (and STORAGE_DRIVER=r2): every file under the local storage
 *     folder -> R2 under the same key (references are keys, so they stay valid).
 * Safe to run again: moved reports are skipped, existing R2 keys are not copied twice.
 */
export const migrateStorage = async ({ copyLocal = false, log = console.log } = {}) => {
  const summary = { reportsMoved: 0, localCopied: 0, localSkipped: 0 };

  const { rows } = await db.query(`SELECT id, attempt_id, language FROM learning_reports WHERE pdf IS NOT NULL ORDER BY id`);
  for (const row of rows) {
    const { rows: found } = await db.query(`SELECT pdf FROM learning_reports WHERE id = $1`, [row.id]);
    const key = reportStorageKey(row.attempt_id, row.language);
    await storage.put(key, found[0].pdf, { contentType: "application/pdf" });
    await db.query(`UPDATE learning_reports SET pdf_storage_key = $2, pdf = NULL, updated_at = NOW() WHERE id = $1`, [row.id, key]);
    summary.reportsMoved++;
  }
  log(`Reports moved from the database into ${storage.driverName} storage: ${summary.reportsMoved}`);

  if (copyLocal) {
    if (storageDriverName() === "local") throw new Error("--copy-local needs STORAGE_DRIVER=r2 (the target).");
    const existing = new Set(await storage.list(""));
    for (const key of await localDriver.list("")) {
      if (existing.has(key)) {
        summary.localSkipped++;
        continue;
      }
      await storage.put(key, await localDriver.get(key));
      summary.localCopied++;
    }
    log(`Local files copied to ${storage.driverName}: ${summary.localCopied} (already there: ${summary.localSkipped})`);
  }
  return summary;
};
