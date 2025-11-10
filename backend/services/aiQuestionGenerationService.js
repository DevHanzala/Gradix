import { GoogleGenerativeAI } from "@google/generative-ai"
import db from "../DB/db.js"

// Initialize Google AI with correct model version
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)

/**
 * AI Question Generation Service
 * Optimized for free tier token usage
 * Uses gemini-1.5-flash (more efficient than gemini-pro)
 */
export class AIQuestionGenerationService {
  constructor() {
    // Use gemini-1.5-flash for better token efficiency
    this.model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
    this.maxTokens = 1000 // Limit token usage for free tier
  }

  /**
   * Generate questions for a specific block
   * Optimized to minimize token consumption
   */
  async generateQuestionsForBlock(blockConfig, assessmentId, instructorId) {
    const startTime = Date.now()
    let auditLogId = null

    try {
      console.log("🤖 Generating questions for block:", blockConfig.block_title)
      
      // Create audit log entry
      auditLogId = await this.createAuditLog({
        assessment_id: assessmentId,
        instructor_id: instructorId,
        block_title: blockConfig.block_title,
        question_type: blockConfig.question_type,
        difficulty_level: blockConfig.difficulty_level,
        question_count: blockConfig.question_count,
        status: "generating"
      })

      // Build optimized prompt for token efficiency
      const prompt = this.buildOptimizedPrompt(blockConfig)
      
      // Generate content with token limits
      const result = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: this.maxTokens,
          temperature: 0.7,
          topP: 0.8,
          topK: 40
        }
      })

      const response = await result.response
      const generatedText = response.text()
      
      // Parse generated questions
      const questions = this.parseGeneratedQuestions(generatedText, blockConfig)
      
      // Validate questions
      const validatedQuestions = this.validateQuestions(questions, blockConfig)
      
      // Update audit log with success
      await this.updateAuditLog(auditLogId, {
        status: "completed",
        questions_generated: validatedQuestions.length,
        ai_response: `Generated ${validatedQuestions.length} ${blockConfig.question_type} questions`,
        generation_time: Date.now() - startTime
      })

      console.log("✅ AI generation successful:", validatedQuestions.length, "questions")
      
      return {
        questions: validatedQuestions,
        generation_time: Date.now() - startTime,
        ai_model_used: "gemini-1.5-flash",
        tokens_used: this.estimateTokenUsage(prompt, generatedText)
      }

    } catch (error) {
      console.error("❌ AI question generation error:", error)
      
      // Update audit log with error
      if (auditLogId) {
        await this.updateAuditLog(auditLogId, {
          status: "failed",
          error_message: error.message,
          generation_time: Date.now() - startTime
        })
      }
      
      throw error
    }
  }

  /**
   * Build optimized prompt for minimal token usage
   */
  buildOptimizedPrompt(blockConfig) {
    const { block_title, question_type, difficulty_level, question_count, topics } = blockConfig
    
    // Use concise prompt format to save tokens
    let prompt = `Generate ${question_count} ${question_type} questions about "${block_title}"`
    
    if (difficulty_level !== "medium") {
      prompt += ` (${difficulty_level} difficulty)`
    }
    
    if (topics && topics.length > 0) {
      prompt += ` covering: ${topics.join(", ")}`
    }
    
    // Add format instructions based on question type
    switch (question_type) {
      case "multiple_choice":
        prompt += `\n\nFormat each question as:\nQ1. [Question text]\nA) [Option]\nB) [Option]\nC) [Option]\nD) [Option]\nCorrect: [Letter]\nMarks: 10`
        break
      case "true_false":
        prompt += `\n\nFormat each question as:\nQ1. [Statement]\nCorrect: [True/False]\nMarks: 5`
        break
      case "short_answer":
        prompt += `\n\nFormat each question as:\nQ1. [Question]\nExpected: [Key points]\nMarks: 15`
        break
      case "essay":
        prompt += `\n\nFormat each question as:\nQ1. [Question]\nRubric: Content(60%), Structure(30%), Language(10%)\nMarks: 25`
        break
    }
    
    prompt += `\n\nKeep questions concise and focused.`
    return prompt
  }

  /**
   * Parse generated text into structured questions
   */
  parseGeneratedQuestions(generatedText, blockConfig) {
    const questions = []
    const lines = generatedText.split('\n').filter(line => line.trim())
    
    let currentQuestion = null
    let questionNumber = 1
    
    for (const line of lines) {
      const trimmedLine = line.trim()
      
      if (trimmedLine.startsWith('Q') && trimmedLine.includes('.')) {
        // Start new question
        if (currentQuestion) {
          questions.push(currentQuestion)
        }
        
        currentQuestion = {
          id: Date.now() + questionNumber,
          question_number: questionNumber,
          question_text: trimmedLine.substring(trimmedLine.indexOf('.') + 1).trim(),
          question_type: blockConfig.question_type,
          difficulty_level: blockConfig.difficulty_level,
          marks: blockConfig.marks_per_question,
          options: [],
          correct_answer: "",
          explanation: "",
          expected_answer: "",
          rubric: null
        }
        questionNumber++
      } else if (currentQuestion) {
        // Parse question details based on type
        this.parseQuestionLine(currentQuestion, trimmedLine, blockConfig.question_type)
      }
    }
    
    // Add last question
    if (currentQuestion) {
      questions.push(currentQuestion)
    }
    
    return questions
  }

  /**
   * Parse individual question lines
   */
  parseQuestionLine(question, line, questionType) {
    if (line.startsWith('A)') || line.startsWith('B)') || line.startsWith('C)') || line.startsWith('D)')) {
      question.options.push(line.substring(2).trim())
    } else if (line.startsWith('Correct:')) {
      question.correct_answer = line.substring(8).trim()
    } else if (line.startsWith('Expected:')) {
      question.expected_answer = line.substring(9).trim()
    } else if (line.startsWith('Marks:')) {
      question.marks = parseInt(line.substring(6).trim()) || question.marks
    } else if (line.startsWith('Rubric:')) {
      question.rubric = this.parseRubric(line.substring(7).trim())
    }
  }

  /**
   * Parse rubric string
   */
  parseRubric(rubricText) {
    const criteria = []
    const parts = rubricText.split(',')
    
    for (const part of parts) {
      const [name, percentage] = part.split('(')
      if (name && percentage) {
        const maxMarks = Math.round((parseInt(percentage) / 100) * 25) // Assuming 25 marks for essay
        criteria.push({
          name: name.trim(),
          max_marks: maxMarks,
          scored: 0
        })
      }
    }
    
    return { criteria }
  }

  /**
   * Validate generated questions
   */
  validateQuestions(questions, blockConfig) {
    return questions.filter(question => {
      // Basic validation
      if (!question.question_text || question.question_text.length < 10) return false
      
      // Type-specific validation
      switch (question.question_type) {
        case "multiple_choice":
          return question.options.length >= 2 && question.correct_answer
        case "true_false":
          return question.correct_answer && ["True", "False"].includes(question.correct_answer)
        case "short_answer":
          return question.expected_answer && question.expected_answer.length > 0
        case "essay":
          return question.rubric && question.rubric.criteria.length > 0
        default:
          return true
      }
    })
  }

  /**
   * Estimate token usage (rough calculation)
   */
  estimateTokenUsage(prompt, response) {
    // Rough estimation: 1 token ≈ 4 characters
    const promptTokens = Math.ceil(prompt.length / 4)
    const responseTokens = Math.ceil(response.length / 4)
    return promptTokens + responseTokens
  }

  /**
   * Create audit log entry
   */
  async createAuditLog(logData) {
    try {
      const query = `
        INSERT INTO ai_generation_audit_logs 
        (assessment_id, instructor_id, action, block_title, question_type, difficulty_level, 
         question_count, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id
      `
      
      const values = [
        logData.assessment_id,
        logData.instructor_id,
        'question_generation', // Add the missing action column
        logData.block_title,
        logData.question_type,
        logData.difficulty_level,
        logData.question_count,
        logData.status
      ]
      
      const result = await db.query(query, values)
      return result.rows[0].id
    } catch (error) {
      console.error("Failed to create audit log:", error)
      return null
    }
  }

  /**
   * Update audit log entry
   */
  async updateAuditLog(auditLogId, updateData) {
    if (!auditLogId) return
    
    try {
      const query = `
        UPDATE ai_generation_audit_logs 
        SET status = $1, 
            questions_generated = $2, 
            ai_response = $3, 
            generation_time = $4,
            error_message = $5,
            updated_at = NOW()
        WHERE id = $6
      `
      
      const values = [
        updateData.status,
        updateData.questions_generated || 0,
        updateData.ai_response || null,
        updateData.generation_time || 0,
        updateData.error_message || null,
        auditLogId
      ]
      
      await db.query(query, values)
    } catch (error) {
      console.error("Failed to update audit log:", error)
    }
  }

  /**
   * Get audit logs for an assessment
   */
  async getAuditLogs(assessmentId) {
    try {
      const query = `
        SELECT * FROM ai_generation_audit_logs 
        WHERE assessment_id = $1 
        ORDER BY created_at DESC
      `
      
      const result = await db.query(query, [assessmentId])
      return result.rows
    } catch (error) {
      console.error("Failed to get audit logs:", error)
      return []
    }
  }
}

// Export singleton instance
const aiService = new AIQuestionGenerationService()
export default aiService

// Export individual functions for backward compatibility
export const generateQuestionsForBlock = (blockConfig, assessmentId, instructorId) => 
  aiService.generateQuestionsForBlock(blockConfig, assessmentId, instructorId)

export const getAuditLogs = (assessmentId) => 
  aiService.getAuditLogs(assessmentId)
