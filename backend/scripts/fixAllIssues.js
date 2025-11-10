import db from "../DB/db.js"

/**
 * Comprehensive fix script for all reported issues
 * This script addresses:
 * 1. Missing columns in assessment_attempts table
 * 2. Missing columns in question_blocks table
 * 3. Missing action column in ai_generation_audit_logs table
 * 4. Any other schema inconsistencies
 */
export const fixAllIssues = async () => {
  try {
    console.log("🔧 Starting comprehensive database fix...")

    // 1. Fix assessment_attempts table
    console.log("📋 Fixing assessment_attempts table...")
    
    // Check and add submitted_at column
    const submittedAtCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'assessment_attempts' 
        AND column_name = 'submitted_at'
      )
    `)

    if (!submittedAtCheck.rows[0].exists) {
      console.log("➕ Adding submitted_at column to assessment_attempts...")
      await db.query(`
        ALTER TABLE assessment_attempts 
        ADD COLUMN submitted_at TIMESTAMP
      `)
      console.log("✅ submitted_at column added successfully")
    } else {
      console.log("✅ submitted_at column already exists")
    }

    // Check and add grade column
    const gradeCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'assessment_attempts' 
        AND column_name = 'grade'
      )
    `)

    if (!gradeCheck.rows[0].exists) {
      console.log("➕ Adding grade column to assessment_attempts...")
      await db.query(`
        ALTER TABLE assessment_attempts 
        ADD COLUMN grade INTEGER
      `)
      console.log("✅ grade column added successfully")
    } else {
      console.log("✅ grade column already exists")
    }

    // Check and add percentage column
    const percentageCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'assessment_attempts' 
        AND column_name = 'percentage'
      )
    `)

    if (!percentageCheck.rows[0].exists) {
      console.log("➕ Adding percentage column to assessment_attempts...")
      await db.query(`
        ALTER TABLE assessment_attempts 
        ADD COLUMN percentage DECIMAL(5,2)
      `)
      console.log("✅ percentage column added successfully")
    } else {
      console.log("✅ percentage column already exists")
    }

    // 2. Fix question_blocks table
    console.log("📋 Fixing question_blocks table...")
    
    // Check and add block_order column
    const blockOrderCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'question_blocks' 
        AND column_name = 'block_order'
      )
    `)

    if (!blockOrderCheck.rows[0].exists) {
      console.log("➕ Adding block_order column to question_blocks...")
      await db.query(`
        ALTER TABLE question_blocks 
        ADD COLUMN block_order INTEGER DEFAULT 1
      `)
      console.log("✅ block_order column added successfully")
    } else {
      console.log("✅ block_order column already exists")
    }

    // Check and add topics column
    const topicsCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'question_blocks' 
        AND column_name = 'topics'
      )
    `)

    if (!topicsCheck.rows[0].exists) {
      console.log("➕ Adding topics column to question_blocks...")
      await db.query(`
        ALTER TABLE question_blocks 
        ADD COLUMN topics TEXT[]
      `)
      console.log("✅ topics column added successfully")
    } else {
      console.log("✅ topics column already exists")
    }

    // 3. Fix ai_generation_audit_logs table
    console.log("📋 Fixing ai_generation_audit_logs table...")
    
    // Check if table exists
    const auditLogsTableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ai_generation_audit_logs'
      )
    `)

    if (!auditLogsTableCheck.rows[0].exists) {
      console.log("➕ Creating ai_generation_audit_logs table...")
      await db.query(`
        CREATE TABLE ai_generation_audit_logs (
          id SERIAL PRIMARY KEY,
          assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
          instructor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          action VARCHAR(100) NOT NULL,
          block_title VARCHAR(255),
          question_count INTEGER,
          question_type VARCHAR(50),
          difficulty_level VARCHAR(20),
          topics TEXT[],
          status VARCHAR(20) DEFAULT 'in_progress',
          questions_generated INTEGER,
          ai_response TEXT,
          error_message TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Create indexes
      await db.query(`
        CREATE INDEX idx_ai_audit_assessment_id ON ai_generation_audit_logs(assessment_id);
        CREATE INDEX idx_ai_audit_instructor_id ON ai_generation_audit_logs(instructor_id);
        CREATE INDEX idx_ai_audit_created_at ON ai_generation_audit_logs(created_at);
      `)

      console.log("✅ ai_generation_audit_logs table created successfully")
    } else {
      console.log("✅ ai_generation_audit_logs table already exists")
      
      // Check if action column exists
      const actionCheck = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'ai_generation_audit_logs' 
          AND column_name = 'action'
        )
      `)

      if (!actionCheck.rows[0].exists) {
        console.log("➕ Adding action column to ai_generation_audit_logs...")
        await db.query(`
          ALTER TABLE ai_generation_audit_logs 
          ADD COLUMN action VARCHAR(100) NOT NULL DEFAULT 'question_generation'
        `)
        console.log("✅ action column added successfully")
      } else {
        console.log("✅ action column already exists")
      }
    }

    // 4. Create question_bank and question_assignments tables if they don't exist
    console.log("📋 Checking question_bank and question_assignments tables...")
    
    const questionBankCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'question_bank'
      )
    `)

    if (!questionBankCheck.rows[0].exists) {
      console.log("➕ Creating question_bank table...")
      await db.query(`
        CREATE TABLE question_bank (
          id SERIAL PRIMARY KEY,
          instructor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          question_text TEXT NOT NULL,
          question_type VARCHAR(50) NOT NULL,
          difficulty_level VARCHAR(20) DEFAULT 'medium',
          topics TEXT[],
          options JSON,
          correct_answer TEXT,
          explanation TEXT,
          marks_per_question INTEGER DEFAULT 1,
          tags TEXT[],
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Create indexes
      await db.query(`
        CREATE INDEX idx_question_bank_instructor_id ON question_bank(instructor_id);
        CREATE INDEX idx_question_bank_question_type ON question_bank(question_type);
        CREATE INDEX idx_question_bank_difficulty_level ON question_bank(difficulty_level);
        CREATE INDEX idx_question_bank_topics ON question_bank USING GIN(topics);
        CREATE INDEX idx_question_bank_tags ON question_bank USING GIN(tags);
      `)

      console.log("✅ question_bank table created successfully")
    } else {
      console.log("✅ question_bank table already exists")
    }

    const questionAssignmentsCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'question_assignments'
      )
    `)

    if (!questionAssignmentsCheck.rows[0].exists) {
      console.log("➕ Creating question_assignments table...")
      await db.query(`
        CREATE TABLE question_assignments (
          id SERIAL PRIMARY KEY,
          question_bank_id INTEGER NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
          assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
          assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(question_bank_id, assessment_id)
        )
      `)

      // Create indexes
      await db.query(`
        CREATE INDEX idx_question_assignments_question_bank_id ON question_assignments(question_bank_id);
        CREATE INDEX idx_question_assignments_assessment_id ON question_assignments(assessment_id);
      `)

      console.log("✅ question_assignments table created successfully")
    } else {
      console.log("✅ question_assignments table already exists")
    }

    console.log("🎉 All database issues fixed successfully!")
    return true

  } catch (error) {
    console.error("❌ Error fixing database issues:", error)
    throw error
  }
}

// Run the fix if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixAllIssues()
    .then(() => {
      console.log("✅ Database fix completed successfully")
      process.exit(0)
    })
    .catch((error) => {
      console.error("❌ Database fix failed:", error)
      process.exit(1)
    })
}

export default fixAllIssues

