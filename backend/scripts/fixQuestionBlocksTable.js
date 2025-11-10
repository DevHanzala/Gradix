import dotenv from "dotenv"
import pool from "../DB/db.js"

// Load environment variables
dotenv.config()

/**
 * Fix existing question_blocks table by adding missing columns
 */
async function fixQuestionBlocksTable() {
  try {
    console.log("🔧 Fixing question_blocks table...")
    
    // Test the connection
    const client = await pool.connect()
    console.log("✅ Database connection successful")
    
    // Check if question_blocks table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'question_blocks'
      )
    `)
    
    if (!tableCheck.rows[0].exists) {
      console.log("❌ question_blocks table doesn't exist. Please run the main application first.")
      client.release()
      return
    }
    
    console.log("✅ question_blocks table exists")
    
    // Check current table structure
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'question_blocks'
      ORDER BY ordinal_position
    `)
    
    console.log("📋 Current table structure:")
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`)
    })
    
    // Check if block_order column exists
    const blockOrderExists = columns.rows.some(col => col.column_name === 'block_order')
    
    if (!blockOrderExists) {
      console.log("➕ Adding block_order column...")
      await client.query(`
        ALTER TABLE question_blocks 
        ADD COLUMN block_order INTEGER NOT NULL DEFAULT 1
      `)
      console.log("✅ block_order column added")
    } else {
      console.log("✅ block_order column already exists")
    }
    
    // Check if topics column exists
    const topicsExists = columns.rows.some(col => col.column_name === 'topics')
    
    if (!topicsExists) {
      console.log("➕ Adding topics column...")
      await client.query(`
        ALTER TABLE question_blocks 
        ADD COLUMN topics TEXT[] DEFAULT '{}'
      `)
      console.log("✅ topics column added")
    } else {
      console.log("✅ topics column already exists")
    }
    
    // Create indexes if they don't exist
    console.log("🔍 Creating/checking indexes...")
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_question_blocks_assessment_id ON question_blocks(assessment_id)
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_question_blocks_order ON question_blocks(block_order)
    `)
    console.log("✅ Indexes created/verified")
    
    // Verify final structure
    const finalColumns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'question_blocks'
      ORDER BY ordinal_position
    `)
    
    console.log("📋 Final table structure:")
    finalColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`)
    })
    
    // Test a simple query
    const testQuery = await client.query(`
      SELECT COUNT(*) FROM question_blocks
    `)
    console.log(`✅ Test query successful. Total question blocks: ${testQuery.rows[0].count}`)
    
    client.release()
    console.log("🎉 Table fix completed successfully!")
    
  } catch (error) {
    console.error("❌ Error fixing table:", error)
  } finally {
    await pool.end()
  }
}

// Run the fix
fixQuestionBlocksTable() 