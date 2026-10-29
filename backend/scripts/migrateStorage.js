import dotenv from "dotenv";

dotenv.config();

/**
 * `npm run storage:migrate`: move PDF reports cached in Postgres into file storage.
 * Add --copy-local (with STORAGE_DRIVER=r2) to also copy every file from the local
 * storage folder (STORAGE_LOCAL_DIR, default backend/storage) to R2.
 */
const main = async () => {
  const { migrateStorage } = await import("../services/storage/migrateStorage.js");
  await migrateStorage({ copyLocal: process.argv.includes("--copy-local") });
  const { default: db } = await import("../DB/db.js");
  await db.end();
};

main().catch((error) => {
  console.error(`Storage migration failed: ${error.message}`);
  process.exit(1);
});
