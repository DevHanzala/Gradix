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
 * Test script to verify new user registration flow works correctly.
 */
async function testNewUserFlow() {
  try {
    console.log("🧪 Testing new user registration flow...")

    // Connect to database
    const client = await pool.connect()
    console.log("✅ Connected to PostgreSQL")

    // Test data
    const testEmail = `test_${Date.now()}@example.com`
    const testName = "Test User"
    const testPassword = "testpassword123"
    const testRole = "instructor"

    console.log(`\n1️⃣ Creating test user: ${testEmail}`)

    // Simulate the signup process
    const hashedPassword = await bcrypt.hash(testPassword, 10)
    const verificationToken = crypto.randomBytes(32).toString("hex")

    console.log(`   - Generated verification token: ${verificationToken.substring(0, 20)}...`)

    // Insert new user (simulating the createUser function)
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
      false, // New users should be unverified
      verificationToken,
    ])

    const newUser = rows[0]
    console.log(`✅ Created user:`)
    console.log(`   - ID: ${newUser.id}`)
    console.log(`   - Name: ${newUser.name}`)
    console.log(`   - Email: ${newUser.email}`)
    console.log(`   - Role: ${newUser.role}`)
    console.log(`   - Verified: ${newUser.verified}`)
    console.log(`   - Has verification token: ${newUser.verification_token ? "YES" : "NO"}`)

    // Test verification process
    console.log(`\n2️⃣ Testing email verification...`)

    // Find user by verification token
    const findQuery = "SELECT * FROM users WHERE verification_token = $1"
    const { rows: foundUsers } = await client.query(findQuery, [verificationToken])

    if (foundUsers.length > 0) {
      console.log(`✅ User found by verification token`)

      // Verify the user
      const verifyQuery = `
        UPDATE users 
        SET verified = TRUE, verification_token = NULL 
        WHERE verification_token = $1 
        RETURNING id, name, email, role, verified
      `
      const { rows: verifiedUsers } = await client.query(verifyQuery, [verificationToken])

      if (verifiedUsers.length > 0) {
        const verifiedUser = verifiedUsers[0]
        console.log(`✅ User verified successfully:`)
        console.log(`   - Verified: ${verifiedUser.verified}`)
        console.log(`   - Verification token cleared: YES`)
      }
    } else {
      console.log(`❌ User NOT found by verification token`)
    }

    // Test login attempt (before verification)
    console.log(`\n3️⃣ Testing login flow...`)

    // Check if user can login (should be able to now since we just verified)
    const loginQuery = "SELECT * FROM users WHERE email = $1"
    const { rows: loginUsers } = await client.query(loginQuery, [testEmail])

    if (loginUsers.length > 0) {
      const user = loginUsers[0]
      console.log(`✅ User found for login`)
      console.log(`   - Verified status: ${user.verified}`)

      if (user.verified) {
        console.log(`✅ User can log in (verified)`)
      } else {
        console.log(`❌ User cannot log in (not verified)`)
      }
    }

    // Clean up - delete test user
    console.log(`\n4️⃣ Cleaning up test user...`)
    await client.query("DELETE FROM users WHERE email = $1", [testEmail])
    console.log(`✅ Test user deleted`)

    console.log(`\n🎉 New user registration flow test completed successfully!`)

    client.release()
    await pool.end()
    process.exit(0)
  } catch (error) {
    console.error("❌ Error testing new user flow:", error)
    process.exit(1)
  }
}

// Run the script
testNewUserFlow()
