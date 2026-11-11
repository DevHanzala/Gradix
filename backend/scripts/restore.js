import dotenv from "dotenv";

dotenv.config();

/**
 * `npm run restore -- <backup key> [--force]`: restore a backup made by `npm run backup`
 * into the database in PG* (migrate it first: `npm run migrate`). Without --force the
 * database must be empty. Example key: backups/gradix-2026-11-11T09-00-00-000Z.ndjson.gz
 */
const main = async () => {
  const key = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!key) throw new Error("Give the backup key (see `npm run backup -- --list`).");
  const { restoreBackup } = await import("../services/backup.js");
  const result = await restoreBackup(key, { force: process.argv.includes("--force") });
  console.log(`Restored ${result.rows} rows into ${result.tables} tables from ${key}`);
  const { default: db } = await import("../DB/db.js");
  await db.end();
};

main().catch((error) => {
  console.error(`Restore failed: ${error.message}`);
  process.exit(1);
});
