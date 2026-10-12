import { spawnSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";
import { createRequire } from "module";

/**
 * Runs Jest in native-ESM mode. Jest's location is resolved instead of
 * hard-coded, so this works whether npm installed it in backend/node_modules
 * or hoisted it to the monorepo root.
 */
const require = createRequire(import.meta.url);
// jest's "exports" map hides bin/jest.js, so locate it via package.json's "bin".
const jestPackageJson = require.resolve("jest/package.json");
const { bin } = JSON.parse(readFileSync(jestPackageJson, "utf8"));
const jestBin = path.join(path.dirname(jestPackageJson), typeof bin === "string" ? bin : bin.jest);

const result = spawnSync(
  process.execPath,
  ["--experimental-vm-modules", jestBin, "--runInBand", "--silent", ...process.argv.slice(2)],
  { stdio: "inherit" }
);
process.exit(result.status ?? 1);
