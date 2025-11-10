// backend/scripts/fixExistingUsers.js
import { connectDB } from "../DB/db.js"
import { verifyExistingUsers } from "../models/userModel.js"

/**
 * Script to fix existing users in the database.
 * This will set existing users as verified since they were created before the verification system.
 */
async function fixExistingUsers() {
  try {
    console.log("🔧 Starting to fix existing users...")

    // Connect to database
    await connectDB()

    // Verify all existing users
    const verifiedUsers = await verifyExistingUsers()

    console.log(`✅ Successfully verified ${verifiedUsers.length} existing users:`)
    verifiedUsers.forEach((user) => {
      console.log(`   - ${user.name} (${user.email})`)
    })

    console.log("🎉 All existing users have been verified and can now log in!")
    process.exit(0)
  } catch (error) {
    console.error("❌ Error fixing existing users:", error)
    process.exit(1)
  }
}

// Run the script
fixExistingUsers()
