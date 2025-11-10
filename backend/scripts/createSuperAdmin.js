import bcrypt from "bcrypt"
import pool from "../DB/db.js"
import dotenv from "dotenv"

dotenv.config()

/**
 * Creates the first and only Super Admin user in the system.
 * This script should be run once only to bootstrap the system.
 */
const createSuperAdmin = async () => {
  let client;
  try {
    console.log("🔄 Starting Super Admin creation...");

    // Connect to the database
    client = await pool.connect();
    console.log("✅ Connected to PostgreSQL database");

    // Start a transaction
    await client.query("BEGIN");
    console.log("🔄 Started database transaction");

    // Ensure users table exists
    console.log("🔄 Ensuring 'users' table exists...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255),
        role VARCHAR(50) NOT NULL DEFAULT 'student',
        verified BOOLEAN DEFAULT FALSE,
        verification_token TEXT,
        provider VARCHAR(50) DEFAULT 'manual',
        uid TEXT,
        reset_token TEXT,
        reset_token_expires TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ 'users' table ensured");

    // Check if Super Admin already exists
    console.log("🔄 Checking for existing Super Admin...");
    const existingQuery = "SELECT * FROM users WHERE role = 'super_admin'";
    const { rows: existing } = await client.query(existingQuery);

    if (existing.length > 0) {
      console.log("❌ Super Admin already exists!");
      console.log("Existing Super Admin:", {
        id: existing[0].id,
        name: existing[0].name,
        email: existing[0].email,
        role: existing[0].role,
      });
      await client.query("ROLLBACK");
      client.release();
      process.exit(1);
    }

    // Super Admin details
    const superAdminData = {
      name: "Super Administrator",
      email: "superadmin@gmail.com",
      password: "***REMOVED***",
      role: "super_admin",
    };

    console.log("🔄 Creating Super Admin with email:", superAdminData.email);

    // Hash the password
    const hashedPassword = await bcrypt.hash(superAdminData.password, 10);
    console.log("✅ Password hashed successfully");

    // Insert Super Admin into database
    const insertQuery = `
      INSERT INTO users (name, email, password, role, verified, provider) 
      VALUES ($1, $2, $3, $4, TRUE, 'manual') 
      RETURNING id, name, email, role, verified, created_at
    `;

    const { rows } = await client.query(insertQuery, [
      superAdminData.name,
      superAdminData.email,
      hashedPassword,
      superAdminData.role,
    ]);

    // Commit the transaction
    await client.query("COMMIT");
    console.log("✅ Transaction committed");

    const newSuperAdmin = rows[0];

    console.log("✅ Super Admin created successfully!");
    console.log("Super Admin Details:", {
      id: newSuperAdmin.id,
      name: newSuperAdmin.name,
      email: newSuperAdmin.email,
      role: newSuperAdmin.role,
      verified: newSuperAdmin.verified,
      created_at: newSuperAdmin.created_at,
    });

    console.log("\n🔐 Login Credentials:");
    console.log(`Email: ${superAdminData.email}`);
    console.log(`Password: ${superAdminData.password}`);
    console.log("\n⚠️ IMPORTANT: Change these credentials after first login!");

    client.release();
    process.exit(0);
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch((rollbackErr) => {
        console.error("❌ Error during rollback:", rollbackErr.message);
      });
      client.release();
    }
    console.error("❌ Error creating Super Admin:", error.message);
    console.error("Error details:", {
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
    });
    process.exit(1);
  }
}

// Run the script
createSuperAdmin();