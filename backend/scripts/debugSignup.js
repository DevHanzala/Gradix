import pg from "pg"
import dotenv from "dotenv"
import crypto from "crypto"
import bcrypt from "bcrypt"

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
 * Debug script to test the signup process step by step.
 */
async function debugSignup() {
  try {
    console.log("🔍 Debugging signup process...")

    // Connect to database
    const client = await pool.connect()
    console.log("✅ Connected to PostgreSQL")

    // Test data
    const testEmail = `debug_${Date.now()}@example.com`
    const testName = "Debug User"
    const testPassword = "debugpassword123"
    const testRole = "instructor"

    console.log(`\n1️⃣ Testing signup for: ${testEmail}`)

    // Step 1: Check if user exists
    console.log("   - Checking if user already exists...")
    const existingUserQuery = "SELECT * FROM users WHERE email = $1"
    const { rows: existingUsers } = await client.query(existingUserQuery, [testEmail])
    console.log(`   - Existing users found: ${existingUsers.length}`)

    // Step 2: Hash password
    console.log("   - Hashing password...")
    const hashedPassword = await bcrypt.hash(testPassword, 10)
    console.log(`   - Password hashed: ${hashedPassword.substring(0, 20)}...`)

    // Step 3: Generate verification token
    console.log("   - Generating verification token...")
    const verificationToken = crypto.randomBytes(32).toString("hex")
    console.log(`   - Verification token: ${verificationToken}`)

    // Step 4: Insert user
    console.log("   - Inserting user into database...")
    const insertQuery = `
      INSERT INTO users (name, email, password, role, verified, verification_token) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING id, name, email, role, verified, verification_token
    `

    const { rows } = await client.query(insertQuery, [
      testName,
      testEmail,
      hashedPassword,
      testRole,
      false, // verified = false for new users
      verificationToken,
    ])

    const newUser = rows[0]
    console.log(`✅ User created successfully:`)
    console.log(`   - ID: ${newUser.id}`)
    console.log(`   - Email: ${newUser.email}`)
    console.log(`   - Verified: ${newUser.verified}`)
    console.log(`   - Token stored: ${newUser.verification_token ? "YES" : "NO"}`)
    console.log(`   - Token matches: ${newUser.verification_token === verificationToken ? "YES" : "NO"}`)

    // Step 5: Test finding user by token
    console.log(`\n2️⃣ Testing token lookup...`)
    const tokenQuery = "SELECT * FROM users WHERE verification_token = $1"
    const { rows: tokenUsers } = await client.query(tokenQuery, [verificationToken])
    console.log(`   - Users found by token: ${tokenUsers.length}`)

    if (tokenUsers.length > 0) {
      console.log(`✅ Token lookup successful`)
    } else {
      console.log(`❌ Token lookup failed`)
    }

    // Step 6: Test verification process
    console.log(`\n3️⃣ Testing verification process...`)
    const verifyQuery = `
      UPDATE users 
      SET verified = TRUE, verification_token = NULL 
      WHERE verification_token = $1 
      RETURNING id, name, email, verified
    `
    const { rows: verifiedUsers } = await client.query(verifyQuery, [verificationToken])

    if (verifiedUsers.length > 0) {
      console.log(`✅ Verification successful`)
      console.log(`   - User verified: ${verifiedUsers[0].verified}`)
    } else {
      console.log(`❌ Verification failed`)
    }

    // Cleanup
    console.log(`\n4️⃣ Cleaning up...`)
    await client.query("DELETE FROM users WHERE email = $1", [testEmail])
    console.log(`✅ Test user deleted`)

    console.log(`\n🎉 Debug completed successfully!`)

    client.release()
    await pool.end()
    process.exit(0)
  } catch (error) {
    console.error("❌ Debug error:", error)
    process.exit(1)
  }
}

// Run the script
debugSignup()
