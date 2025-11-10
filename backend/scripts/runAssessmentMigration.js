import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import pool from "../DB/db.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function runMigration() {
  try {
    console.log("🚀 Starting assessment schema migration...")

    // Read the SQL file
    const sqlFile = path.join(__dirname, "createAssessmentSchema.sql")
    const sql = fs.readFileSync(sqlFile, "utf8")

    // Execute the SQL
    await pool.query(sql)

    console.log("✅ Assessment schema migration completed successfully!")
    console.log("📊 Sample assessments and question blocks have been created.")

    // Verify the migration
    const result = await pool.query("SELECT COUNT(*) FROM assessments")
    console.log(`📈 Total assessments in database: ${result.rows[0].count}`)

    process.exit(0)
  } catch (error) {
    console.error("❌ Migration failed:", error)
    process.exit(1)
  }
}

runMigration()
