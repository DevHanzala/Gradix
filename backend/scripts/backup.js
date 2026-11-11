import dotenv from "dotenv";

dotenv.config();

/**
 * `npm run backup`: write a full logical backup of the database to file storage
 * (backups/gradix-<time>.ndjson.gz in R2 when STORAGE_DRIVER=r2). `--list` shows backups.
 */
const main = async () => {
  const { createBackup, listBackups } = await import("../services/backup.js");
  if (process.argv.includes("--list")) {
    for (const key of await listBackups()) console.log(key);
  } else {
    const result = await createBackup();
    console.log(`Backup stored: ${result.key} (${result.tables} tables, ${result.rows} rows, ${Math.round(result.bytes / 1024)} KB)`);
  }
  const { default: db } = await import("../DB/db.js");
  await db.end();
};

main().catch((error) => {
  console.error(`Backup failed: ${error.message}`);
  process.exit(1);
});
