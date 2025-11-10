import db from "../DB/db.js"

/**
 * Fix assessment_attempts table by adding missing columns
 * This script adds the missing columns that are referenced in the dashboard controller
 */
export const fixAssessmentAttemptsTable = async () => {
  try {
    console.log("🔧 Checking assessment_attempts table structure...")

    // Check if submitted_at column exists
    const submittedAtCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'assessment_attempts' 
        AND column_name = 'submitted_at'
      )
    `)

    if (!submittedAtCheck.rows[0].exists) {
      console.log("➕ Adding submitted_at column...")
      await db.query(`
        ALTER TABLE assessment_attempts 
        ADD COLUMN submitted_at TIMESTAMP
      `)
      console.log("✅ submitted_at column added successfully")
    } else {
      console.log("✅ submitted_at column already exists")
    }

    // Check if grade column exists
    const gradeCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'assessment_attempts' 
        AND column_name = 'grade'
      )
    `)

    if (!gradeCheck.rows[0].exists) {
      console.log("➕ Adding grade column...")
      await db.query(`
        ALTER TABLE assessment_attempts 
        ADD COLUMN grade INTEGER
      `)
      console.log("✅ grade column added successfully")
    } else {
      console.log("✅ grade column already exists")
    }

    // Check if percentage column exists
    const percentageCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'assessment_attempts' 
        AND column_name = 'percentage'
      )
    `)

    if (!percentageCheck.rows[0].exists) {
      console.log("➕ Adding percentage column...")
      await db.query(`
        ALTER TABLE assessment_attempts 
        ADD COLUMN percentage DECIMAL(5,2)
      `)
      console.log("✅ percentage column added successfully")
    } else {
      console.log("✅ percentage column already exists")
    }

    console.log("🎉 assessment_attempts table structure updated successfully!")
    return true
  } catch (error) {
    console.error("❌ Error fixing assessment_attempts table:", error)
    throw error
  }
}

// Run the fix if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixAssessmentAttemptsTable()
    .then(() => {
      console.log("✅ Migration completed successfully")
      process.exit(0)
    })
    .catch((error) => {
      console.error("❌ Migration failed:", error)
      process.exit(1)
    })
}
