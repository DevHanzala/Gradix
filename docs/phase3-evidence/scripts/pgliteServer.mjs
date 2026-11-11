/**
 * A throwaway local Postgres (PGlite with pgvector) on a TCP port, for evidence runs when
 * Docker is not available. Single connection: run the app with PGPOOL_MAX=1.
 *   node pgliteServer.mjs <backendDir> [port=55440]
 */
import path from "path";
import { createRequire } from "module";
import { pathToFileURL } from "url";

const backendDir = path.resolve(process.argv[2]);
const port = Number(process.argv[3] || 55440);
const require = createRequire(path.join(backendDir, "package.json"));
const load = (name) => import(pathToFileURL(require.resolve(name)).href);
const { PGlite } = await load("@electric-sql/pglite");
const { vector } = await load("@electric-sql/pglite-pgvector");
const { PGLiteSocketServer } = await load("@electric-sql/pglite-socket");
const db = await PGlite.create({ extensions: { vector } });
const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 4 });
await server.start();
console.log(`PGLITE READY ${port}`);
const stop = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
