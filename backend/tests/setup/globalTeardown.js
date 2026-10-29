import fs from "fs/promises";

export default async function globalTeardown() {
  await globalThis.__stopTestDatabase__?.();
  if (process.env.STORAGE_LOCAL_DIR?.includes("gradix-test-storage-")) {
    await fs.rm(process.env.STORAGE_LOCAL_DIR, { recursive: true, force: true });
  }
}
