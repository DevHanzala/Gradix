import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

// PGSSLMODE=disable is used for local/test databases; everything else uses TLS.
const ssl = process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: true };

const pool = new Pool({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  port: Number(process.env.PGPORT) || 5432,
  ssl,
  max: Number(process.env.PGPOOL_MAX) || 10,
});

export const connectDB = async () => {
  const client = await pool.connect();
  client.release();
};

/**
 * Run `fn` inside a transaction. `fn` receives a dedicated client and must use
 * it (not the pool) for every query that belongs to the transaction.
 */
export const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

export default pool;
