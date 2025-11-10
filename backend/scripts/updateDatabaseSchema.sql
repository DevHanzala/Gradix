-- Update database schema for Grade Wise AI Assessment Platform
-- Run this script to update existing database structure

-- First, let's add the new columns to users table if they don't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS uid VARCHAR(255),
ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'en';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider);
CREATE INDEX IF NOT EXISTS idx_users_uid ON users(uid);

-- Rename courses table to assessments (if courses table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'courses') THEN
        -- Rename courses to assessments
        ALTER TABLE courses RENAME TO assessments;
        ALTER TABLE assessments RENAME COLUMN title TO name;
        ALTER TABLE assessments RENAME COLUMN instructor_id TO created_by;
        
        -- Add new assessment-specific columns
        ALTER TABLE assessments 
        ADD COLUMN IF NOT EXISTS ai_instructions TEXT,
        ADD COLUMN IF NOT EXISTS time_limit INTEGER DEFAULT 60,
        ADD COLUMN IF NOT EXISTS total_marks INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';
    ELSE
        -- Create assessments table from scratch
        CREATE TABLE assessments (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            ai_instructions TEXT,
            time_limit INTEGER DEFAULT 60,
            total_marks INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT true,
            language VARCHAR(10) DEFAULT 'en',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    END IF;
END $$;

-- Create resources table for uploaded content
CREATE TABLE IF NOT EXISTS resources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500),
    file_type VARCHAR(50),
    file_size BIGINT,
    url VARCHAR(500),
    content_type ENUM('file', 'link') NOT NULL,
    visibility ENUM('private', 'public') DEFAULT 'private',
    uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vectorized BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create assessment_resources junction table
CREATE TABLE IF NOT EXISTS assessment_resources (
    id SERIAL PRIMARY KEY,
    assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(assessment_id, resource_id)
);

-- Create question_blocks table
CREATE TABLE IF NOT EXISTS question_blocks (
    id SERIAL PRIMARY KEY,
    assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    block_type ENUM('mcq', 'short_answer', 'true_false', 'matching') NOT NULL,
    question_count INTEGER NOT NULL DEFAULT 5,
    duration_per_question INTEGER NOT NULL DEFAULT 60,
    positive_marks DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    negative_marks DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    mcq_options INTEGER DEFAULT 4,
    matching_left_options INTEGER DEFAULT 3,
    matching_right_options INTEGER DEFAULT 4,
    block_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Rename students_courses to student_assessments
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'students_courses') THEN
        ALTER TABLE students_courses RENAME TO student_assessments;
        ALTER TABLE student_assessments RENAME COLUMN course_id TO assessment_id;
    ELSE
        CREATE TABLE student_assessments (
            id SERIAL PRIMARY KEY,
            student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
            enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(student_id, assessment_id)
        );
    END IF;
END $$;

-- Create assessment_attempts table
CREATE TABLE IF NOT EXISTS assessment_attempts (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP WITH TIME ZONE,
    time_taken INTEGER, -- in seconds
    total_score DECIMAL(5,2) DEFAULT 0.00,
    max_score DECIMAL(5,2) DEFAULT 0.00,
    percentage DECIMAL(5,2) DEFAULT 0.00,
    status ENUM('in_progress', 'submitted', 'evaluated') DEFAULT 'in_progress',
    language VARCHAR(10) DEFAULT 'en'
);

-- Create generated_questions table
CREATE TABLE IF NOT EXISTS generated_questions (
    id SERIAL PRIMARY KEY,
    attempt_id INTEGER NOT NULL REFERENCES assessment_attempts(id) ON DELETE CASCADE,
    block_id INTEGER NOT NULL REFERENCES question_blocks(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type ENUM('mcq', 'short_answer', 'true_false', 'matching') NOT NULL,
    options JSON, -- For MCQ and matching questions
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    source_reference TEXT,
    marks DECIMAL(5,2) NOT NULL,
    question_order INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create student_answers table
CREATE TABLE IF NOT EXISTS student_answers (
    id SERIAL PRIMARY KEY,
    attempt_id INTEGER NOT NULL REFERENCES assessment_attempts(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES generated_questions(id) ON DELETE CASCADE,
    student_answer TEXT,
    is_correct BOOLEAN,
    marks_awarded DECIMAL(5,2) DEFAULT 0.00,
    ai_feedback TEXT,
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create ai_configurations table
CREATE TABLE IF NOT EXISTS ai_configurations (
    id SERIAL PRIMARY KEY,
    provider VARCHAR(50) NOT NULL, -- 'openai', 'google', 'anthropic'
    api_key VARCHAR(500) NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    cost_per_token DECIMAL(10,6) DEFAULT 0.000001,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create api_usage_logs table for cost tracking
CREATE TABLE IF NOT EXISTS api_usage_logs (
    id SERIAL PRIMARY KEY,
    provider VARCHAR(50) NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    tokens_used INTEGER NOT NULL,
    cost DECIMAL(10,6) NOT NULL,
    operation_type VARCHAR(50) NOT NULL, -- 'question_generation', 'evaluation', 'feedback'
    user_id INTEGER REFERENCES users(id),
    assessment_id INTEGER REFERENCES assessments(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Update assignments table to be compatible (if it exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'assignments') THEN
        -- Keep assignments table but add reference to assessments
        ALTER TABLE assignments 
        ADD COLUMN IF NOT EXISTS assessment_id INTEGER REFERENCES assessments(id);
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assessments_created_by ON assessments(created_by);
CREATE INDEX IF NOT EXISTS idx_resources_uploaded_by ON resources(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_student ON assessment_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_assessment ON assessment_attempts(assessment_id);
CREATE INDEX IF NOT EXISTS idx_generated_questions_attempt ON generated_questions(attempt_id);
CREATE INDEX IF NOT EXISTS idx_student_answers_attempt ON student_answers(attempt_id);

-- Insert default AI configurations (commented out - admin will add these)
-- INSERT INTO ai_configurations (provider, api_key, model_name, created_by) VALUES
-- ('openai', 'YOUR_OPENAI_API_KEY', 'gpt-4', 1),
-- ('google', 'YOUR_GOOGLE_API_KEY', 'gemini-pro', 1),
-- ('anthropic', 'YOUR_CLAUDE_API_KEY', 'claude-3-sonnet', 1);

COMMIT;
