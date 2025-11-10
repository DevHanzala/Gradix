import pool from '../DB/db.js';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  try {
    console.log('🔄 Running database migration...');
    
    // Read the migration SQL file
    const sqlPath = path.join(process.cwd(), 'scripts', 'createStudentTables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the migration
    await pool.query(sql);
    
    console.log('✅ Migration completed successfully');
    
    // Test the tables exist
    const tables = ['assessment_attempts', 'generated_questions', 'student_answers', 'enrollments'];
    for (const table of tables) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [table]);
      console.log(`📋 Table ${table}: ${result.rows[0].exists ? '✅ exists' : '❌ missing'}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();