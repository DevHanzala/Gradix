import pg from "pg"
import dotenv from "dotenv"

// Load environment variables
dotenv.config()

const { Pool } = pg

// Create a new Pool instance for connecting to PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
})

/**
 * Simple script to fix existing users in the database.
 * This will set existing users as verified since they were created before the verification system.
 */
async function fixExistingUsers() {
  try {
    console.log("🔧 Starting to fix existing users...")

    // Connect to database
    const client = await pool.connect()
    console.log("✅ Connected to PostgreSQL")

    // Update existing users to be verified
    const query = `
      UPDATE users 
      SET verified = TRUE, verification_token = NULL 
      WHERE verified IS NULL OR verified = FALSE
      RETURNING id, email, name
    `

    const { rows } = await client.query(query)

    console.log(`✅ Successfully verified ${rows.length} existing users:`)
    rows.forEach((user) => {
      console.log(`   - ${user.name} (${user.email})`)
    })

    console.log("🎉 All existing users have been verified and can now log in!")

    client.release()
    await pool.end()
    process.exit(0)
  } catch (error) {
    console.error("❌ Error fixing existing users:", error)
    process.exit(1)
  }
}

// Run the script
fixExistingUsers()
