import path from "path";
import { fileURLToPath } from "url";
import net from "net";
import { runner } from "node-pg-migrate";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "..", "..", "migrations");

/**
 * Test database:
 * - If TEST_PGHOST is set, use that real Postgres (needs the pgvector extension).
 * - Otherwise start an in-process PGlite (Postgres compiled to WASM, with pgvector)
 *   behind a local socket, so `npm test` needs no external services.
 * Sets PG* env vars for the app and runs all migrations.
 */
/** Ask the OS for a free local port (random ports can hit reserved ranges on Windows). */
const getFreePort = () =>
  new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

export const startTestDatabase = async () => {
  let stop = async () => {};

  if (process.env.TEST_PGHOST) {
    process.env.PGHOST = process.env.TEST_PGHOST;
    process.env.PGPORT = process.env.TEST_PGPORT || "5432";
    process.env.PGDATABASE = process.env.TEST_PGDATABASE || "gradix_test";
    process.env.PGUSER = process.env.TEST_PGUSER || "postgres";
    process.env.PGPASSWORD = process.env.TEST_PGPASSWORD || "postgres";
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const { vector } = await import("@electric-sql/pglite-pgvector");
    const { PGLiteSocketServer } = await import("@electric-sql/pglite-socket");

    const db = await PGlite.create({ extensions: { vector } });
    const port = await getFreePort();
    // A few socket slots cover connect/disconnect overlap (e.g. migrations then the
    // app pool); the app pool itself uses ONE client, so transactions never interleave.
    const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 4 });
    await server.start();

    process.env.PGHOST = "127.0.0.1";
    process.env.PGPORT = String(port);
    process.env.PGDATABASE = "postgres";
    process.env.PGUSER = "postgres";
    process.env.PGPASSWORD = "postgres";
    // PGlite is single-connection: one pooled client keeps transactions isolated.
    process.env.PGPOOL_MAX = "1";

    stop = async () => {
      await server.stop();
      await db.close();
    };
  }

  process.env.PGSSLMODE = "disable";

  await runner({
    databaseUrl: {
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT),
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl: false,
    },
    dir: MIGRATIONS_DIR,
    direction: "up",
    count: Infinity,
    migrationsTable: "pgmigrations",
    log: () => {},
  });

  return stop;
};
