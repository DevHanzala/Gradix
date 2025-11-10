// backend/scripts/checkUsers.js
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
 * Script to check the current state of users in the database.
 */
async function checkUsers() {
  try {
    console.log("🔍 Checking current users in database...")

    // Connect to database
    const client = await pool.connect()
    console.log("✅ Connected to PostgreSQL")

    // Get all users with their verification status
    const query = `
      SELECT id, name, email, role, verified, verification_token, created_at
      FROM users 
      ORDER BY created_at DESC
    `

    const { rows } = await client.query(query)

    console.log(`\n📊 Found ${rows.length} users in database:`)
    console.log("=".repeat(80))

    rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email})`)
      console.log(`   Role: ${user.role}`)
      console.log(`   Verified: ${user.verified}`)
      console.log(
        `   Verification Token: ${user.verification_token ? user.verification_token.substring(0, 10) + "..." : "NULL"}`,
      )
      console.log(`   Created: ${user.created_at}`)
      console.log("-".repeat(40))
    })

    // Check table structure
    const tableInfoQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `

    const { rows: columns } = await client.query(tableInfoQuery)
    console.log("\n🏗️  Table structure:")
    console.log("=".repeat(80))
    columns.forEach((col) => {
      console.log(`${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`)
    })

    client.release()
    await pool.end()
    process.exit(0)
  } catch (error) {
    console.error("❌ Error checking users:", error)
    process.exit(1)
  }
}

// Run the script
checkUsers()
