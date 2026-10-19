import dotenv from "dotenv";

dotenv.config();

/**
 * `npm run rechunk`: queue re-chunking + re-embedding of every resource that
 * is on an older chunking/embedding version. The worker does the work.
 * Pass --now to process them in this process instead (no worker needed).
 */
const main = async () => {
  const { queueAdapter, stopBoss, enqueue } = await import("../jobs/index.js");
  if (process.argv.includes("--now")) queueAdapter.mode = "inline";
  await enqueue("resources.rechunk-sweep", {}, { singletonKey: "sweep" });
  console.log(queueAdapter.mode === "inline" ? "Re-chunking finished." : "Re-chunk sweep queued; the worker will process it.");
  await stopBoss();
  const { default: db } = await import("../DB/db.js");
  await db.end();
};

main().catch((error) => {
  console.error(`Re-chunk failed: ${error.message}`);
  process.exit(1);
});
