import { Pool } from "pg";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Create a new pool instance
const pool = new Pool({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  port: 5432,
  ssl: {
    require: true,
  },
});

/**
 * Function to connect to the database
 */
export const connectDB = async () => {
  try {
    const client = await pool.connect();
    console.log("✅ Connected to PostgreSQL database successfully!");
    client.release();
  } catch (error) {
    console.error("❌ Database connection error:", error);
    throw error;
  }
};

// Export the pool
export default pool;