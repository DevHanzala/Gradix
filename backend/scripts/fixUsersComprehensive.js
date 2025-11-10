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
 * Comprehensive script to fix existing users in the database.
 */
async function fixUsersComprehensive() {
  try {
    console.log("🔧 Starting comprehensive user fix...")

    // Connect to database
    const client = await pool.connect()
    console.log("✅ Connected to PostgreSQL")

    // First, let's see what we have
    console.log("\n1️⃣ Checking current user status...")
    const checkQuery = `SELECT id, name, email, verified, verification_token FROM users`
    const { rows: currentUsers } = await client.query(checkQuery)

    console.log(`Found ${currentUsers.length} users:`)
    currentUsers.forEach((user) => {
      console.log(
        `   - ${user.name} (${user.email}): verified=${user.verified}, token=${user.verification_token ? "EXISTS" : "NULL"}`,
      )
    })

    // Step 1: Add columns if they don't exist (for very old tables)
    console.log("\n2️⃣ Ensuring table has required columns...")
    try {
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE`)
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255)`)
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255)`)
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP`)
      console.log("✅ Table columns verified/added")
    } catch (error) {
      console.log("⚠️  Column addition error (might already exist):", error.message)
    }

    // Step 2: Fix users with NULL verified status
    console.log("\n3️⃣ Fixing users with NULL verified status...")
    const fixNullQuery = `
      UPDATE users 
      SET verified = TRUE, verification_token = NULL 
      WHERE verified IS NULL
      RETURNING id, name, email
    `
    const { rows: fixedNullUsers } = await client.query(fixNullQuery)
    console.log(`✅ Fixed ${fixedNullUsers.length} users with NULL verified status`)

    // Step 3: Fix users with FALSE verified status (existing users should be verified)
    console.log("\n4️⃣ Fixing existing users with FALSE verified status...")
    const fixFalseQuery = `
      UPDATE users 
      SET verified = TRUE, verification_token = NULL 
      WHERE verified = FALSE AND created_at < NOW() - INTERVAL '1 hour'
      RETURNING id, name, email
    `
    const { rows: fixedFalseUsers } = await client.query(fixFalseQuery)
    console.log(`✅ Fixed ${fixedFalseUsers.length} existing users with FALSE verified status`)

    // Step 4: Show final status
    console.log("\n5️⃣ Final user status:")
    const { rows: finalUsers } = await client.query(checkQuery)
    finalUsers.forEach((user) => {
      console.log(`   - ${user.name} (${user.email}): verified=${user.verified}`)
    })

    const totalFixed = fixedNullUsers.length + fixedFalseUsers.length
    console.log(`\n🎉 Successfully processed ${totalFixed} users!`)

    if (totalFixed > 0) {
      console.log("✅ Your existing users can now log in without email verification!")
    } else {
      console.log("ℹ️  All users were already properly configured.")
    }

    client.release()
    await pool.end()
    process.exit(0)
  } catch (error) {
    console.error("❌ Error fixing users:", error)
    process.exit(1)
  }
}

// Run the script
fixUsersComprehensive()
