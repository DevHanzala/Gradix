import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { runner } from "node-pg-migrate";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Usage: node scripts/migrate.js [up|down] [count]
 * Uses the same PG* variables as the app (see .env.example).
 */
const direction = process.argv[2] === "down" ? "down" : "up";
const count = process.argv[3] ? Number(process.argv[3]) : direction === "down" ? 1 : Infinity;

const databaseUrl = {
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: true },
};

try {
  const applied = await runner({
    databaseUrl,
    dir: path.join(__dirname, "..", "migrations"),
    direction,
    count,
    migrationsTable: "pgmigrations",
    log: (msg) => console.log(msg),
  });
  console.log(`Migrations ${direction}: ${applied.length} applied.`);
  process.exit(0);
} catch (error) {
  console.error(`Migration failed: ${error.message}`);
  process.exit(1);
}
