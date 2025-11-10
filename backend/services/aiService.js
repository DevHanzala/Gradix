import fs from "fs"
import { promises as fsPromises } from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const QUESTIONS_DIR = path.join(__dirname, "..", "generated_questions")

// Ensure questions directory exists
if (!fs.existsSync(QUESTIONS_DIR)) {
  fs.mkdirSync(QUESTIONS_DIR, { recursive: true })
}

/**
 * Generate questions using AI (mock implementation)
 * @param {Object} params - Generation parameters
 * @returns {Promise<Array>} Generated questions
 */
export const generateQuestions = async (prompt, count = 5, type = "multiple_choice") => {
  try {
    console.log(`🤖 Generating ${count} ${type} questions...`)

    // Mock AI generation - replace with real AI service
    const questions = []

    for (let i = 1; i <= count; i++) {
      let question

      switch (type) {
        case "multiple_choice":
          question = {
            id: `generated_${Date.now()}_${i}`,
            question_text: `Sample multiple choice question ${i} about: ${prompt}`,
            question_type: "multiple_choice",
            options: [
              `Option A for question ${i}`,
              `Option B for question ${i}`,
              `Option C for question ${i}`,
              `Option D for question ${i}`,
            ],
            correct_answer: `Option A for question ${i}`,
            explanation: `This is the explanation for question ${i}. The correct answer is A because...`,
            marks: 2,
            difficulty_level: "medium",
            tags: ["ai-generated", "sample"],
            source_reference: prompt,
          }
          break

        case "true_false":
          question = {
            id: `generated_${Date.now()}_${i}`,
            question_text: `True or False: Sample statement ${i} about ${prompt}`,
            question_type: "true_false",
            options: ["True", "False"],
            correct_answer: i % 2 === 0 ? "True" : "False",
            explanation: `This statement is ${i % 2 === 0 ? "true" : "false"} because...`,
            marks: 1,
            difficulty_level: "easy",
            tags: ["ai-generated", "true-false"],
            source_reference: prompt,
          }
          break

        case "short_answer":
          question = {
            id: `generated_${Date.now()}_${i}`,
            question_text: `Short answer question ${i}: Explain the concept of ${prompt}`,
            question_type: "short_answer",
            options: null,
            correct_answer: `Sample answer for question ${i}`,
            explanation: `Key points to include in the answer: ...`,
            marks: 5,
            difficulty_level: "medium",
            tags: ["ai-generated", "short-answer"],
            source_reference: prompt,
          }
          break

        default:
          question = {
            id: `generated_${Date.now()}_${i}`,
            question_text: `Sample question ${i} about: ${prompt}`,
            question_type: type,
            options: null,
            correct_answer: `Sample answer ${i}`,
            explanation: `Explanation for question ${i}`,
            marks: 3,
            difficulty_level: "medium",
            tags: ["ai-generated"],
            source_reference: prompt,
          }
      }

      questions.push(question)
    }

    console.log(`✅ Generated ${questions.length} questions`)
    return questions
  } catch (error) {
    console.error("❌ Error generating questions:", error)
    throw error
  }
}

/**
 * Save questions to file
 * @param {string} assessmentId - Assessment ID
 * @param {Array} questions - Questions to save
 * @returns {Promise<string>} File path
 */
export const saveQuestionsToFile = async (assessmentId, questions) => {
  try {
    const filename = `assessment_${assessmentId}_questions_${Date.now()}.json`
    const filepath = path.join(QUESTIONS_DIR, filename)

    const data = {
      assessment_id: assessmentId,
      generated_at: new Date().toISOString(),
      questions_count: questions.length,
      questions: questions,
    }

    await fsPromises.writeFile(filepath, JSON.stringify(data, null, 2))
    console.log(`💾 Questions saved to: ${filename}`)

    return {
      filename,
      filepath,
      questions_count: questions.length,
    }
  } catch (error) {
    console.error("❌ Error saving questions:", error)
    throw error
  }
}

/**
 * Load questions from file
 * @param {string} filename - Filename to load
 * @returns {Promise<Array>} Questions
 */
export const loadQuestionsFromFile = async (filename) => {
  try {
    const filepath = path.join(QUESTIONS_DIR, filename)

    if (!fs.existsSync(filepath)) {
      throw new Error(`File not found: ${filename}`)
    }

    const data = await fsPromises.readFile(filepath, "utf8")
    const parsed = JSON.parse(data)

    console.log(`📂 Loaded ${parsed.questions_count} questions from: ${filename}`)
    return parsed
  } catch (error) {
    console.error("❌ Error loading questions:", error)
    throw error
  }
}

/**
 * Get all question files for an assessment
 * @param {string} assessmentId - Assessment ID
 * @returns {Array} File information
 */
export const getAssessmentQuestionFiles = async (assessmentId) => {
  try {
    const files = await fsPromises.readdir(QUESTIONS_DIR)
    const assessmentFiles = files.filter(
      (file) => file.startsWith(`assessment_${assessmentId}_`) && file.endsWith(".json"),
    )

    const fileDetails = []

    for (const file of assessmentFiles) {
      try {
        const filepath = path.join(QUESTIONS_DIR, file)
        const stats = await fsPromises.stat(filepath)
        const data = await fsPromises.readFile(filepath, "utf8")
        const parsed = JSON.parse(data)

        fileDetails.push({
          filename: file,
          size: stats.size,
          created_at: stats.birthtime,
          modified_at: stats.mtime,
          questions_count: parsed.questions_count || 0,
          generated_at: parsed.generated_at,
        })
      } catch (error) {
        console.error(`Error reading file ${file}:`, error)
      }
    }

    return fileDetails.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  } catch (error) {
    console.error("❌ Error getting question files:", error)
    throw error
  }
}

/**
 * Delete assessment question files
 * @param {string} assessmentId - Assessment ID
 * @param {string} filename - Optional filename to delete
 * @returns {Object} Deleted files information
 */
export const deleteAssessmentQuestions = async (assessmentId, filename = null) => {
  try {
    if (filename) {
      // Delete specific file
      const filepath = path.join(QUESTIONS_DIR, filename)
      if (fs.existsSync(filepath)) {
        await fsPromises.unlink(filepath)
        console.log(`🗑️ Deleted file: ${filename}`)
        return { deleted: [filename] }
      } else {
        throw new Error(`File not found: ${filename}`)
      }
    } else {
      // Delete all files for assessment
      const files = await fsPromises.readdir(QUESTIONS_DIR)
      const assessmentFiles = files.filter(
        (file) => file.startsWith(`assessment_${assessmentId}_`) && file.endsWith(".json"),
      )

      const deleted = []
      for (const file of assessmentFiles) {
        const filepath = path.join(QUESTIONS_DIR, file)
        await fsPromises.unlink(filepath)
        deleted.push(file)
      }

      console.log(`🗑️ Deleted ${deleted.length} files for assessment ${assessmentId}`)
      return { deleted }
    }
  } catch (error) {
    console.error("❌ Error deleting questions:", error)
    throw error
  }
}

/**
 * Validate question format
 * @param {Object} question - Question to validate
 * @returns {Object} Validation result
 */
export const validateQuestion = (question) => {
  const errors = []

  if (!question.question_text || question.question_text.trim().length === 0) {
    errors.push("Question text is required")
  }

  if (!question.question_type) {
    errors.push("Question type is required")
  }

  if (!question.correct_answer || question.correct_answer.trim().length === 0) {
    errors.push("Correct answer is required")
  }

  if (question.question_type === "multiple_choice") {
    if (!question.options || !Array.isArray(question.options) || question.options.length < 2) {
      errors.push("Multiple choice questions must have at least 2 options")
    }

    if (question.options && !question.options.includes(question.correct_answer)) {
      errors.push("Correct answer must be one of the provided options")
    }
  }

  if (question.question_type === "true_false") {
    if (!["True", "False", "true", "false"].includes(question.correct_answer)) {
      errors.push('True/False questions must have "True" or "False" as correct answer')
    }
  }

  if (question.marks && (isNaN(question.marks) || question.marks <= 0)) {
    errors.push("Marks must be a positive number")
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Format questions for export
 * @param {Array} questions - Questions to format
 * @param {string} format - Export format (json, csv, txt)
 * @returns {string} Formatted content
 */
export const formatQuestionsForExport = (questions, format = "json") => {
  try {
    switch (format.toLowerCase()) {
      case "json":
        return JSON.stringify(questions, null, 2)

      case "csv":
        if (questions.length === 0) return ""

        const headers = [
          "Question Text",
          "Type",
          "Options",
          "Correct Answer",
          "Explanation",
          "Marks",
          "Difficulty",
          "Tags",
        ]
        const csvRows = [headers.join(",")]

        questions.forEach((q) => {
          const row = [
            `"${q.question_text.replace(/"/g, '""')}"`,
            q.question_type,
            `"${Array.isArray(q.options) ? q.options.join("; ") : q.options || ""}"`,
            `"${q.correct_answer.replace(/"/g, '""')}"`,
            `"${(q.explanation || "").replace(/"/g, '""')}"`,
            q.marks || 1,
            q.difficulty_level || "medium",
            `"${Array.isArray(q.tags) ? q.tags.join("; ") : ""}"`,
          ]
          csvRows.push(row.join(","))
        })

        return csvRows.join("\n")

      case "txt":
        return questions
          .map((q, index) => {
            let text = `Question ${index + 1}: ${q.question_text}\n`
            text += `Type: ${q.question_type}\n`

            if (q.options && Array.isArray(q.options)) {
              text += `Options:\n${q.options.map((opt, i) => `  ${String.fromCharCode(65 + i)}. ${opt}`).join("\n")}\n`
            }

            text += `Correct Answer: ${q.correct_answer}\n`

            if (q.explanation) {
              text += `Explanation: ${q.explanation}\n`
            }

            text += `Marks: ${q.marks || 1}\n`
            text += `Difficulty: ${q.difficulty_level || "medium"}\n`

            if (q.tags && q.tags.length > 0) {
              text += `Tags: ${q.tags.join(", ")}\n`
            }

            return text
          })
          .join("\n" + "=".repeat(50) + "\n\n")

      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  } catch (error) {
    console.error("❌ Error formatting questions:", error)
    throw error
  }
}

/**
 * Import questions from formatted text
 * @param {string} data - Content to import
 * @param {string} format - Import format (json, csv, txt)
 * @returns {Array} Imported questions
 */
export const importQuestionsFromFormat = (data, format = "json") => {
  try {
    switch (format.toLowerCase()) {
      case "json":
        const parsed = JSON.parse(data)
        return Array.isArray(parsed) ? parsed : parsed.questions || []

      case "csv":
        const lines = data.split("\n").filter((line) => line.trim())
        if (lines.length < 2) throw new Error("CSV must have header and at least one data row")

        const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim())
        const questions = []

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(",").map((v) => v.replace(/"/g, "").trim())

          const question = {
            question_text: values[0] || "",
            question_type: values[1] || "multiple_choice",
            options: values[2] ? values[2].split("; ") : [],
            correct_answer: values[3] || "",
            explanation: values[4] || "",
            marks: Number.parseInt(values[5]) || 1,
            difficulty_level: values[6] || "medium",
            tags: values[7] ? values[7].split("; ") : [],
          }

          questions.push(question)
        }

        return questions

      default:
        throw new Error(`Unsupported import format: ${format}`)
    }
  } catch (error) {
    console.error("❌ Error importing questions:", error)
    throw error
  }
}

/**
 * Generate questions with AI (placeholder for real AI integration)
 * @param {Object} config - Configuration for AI question generation
 * @returns {Promise<Array>} Generated questions
 */
export const generateQuestionsWithAI = async (config) => {
  const { topic, count = 5, difficulty = "medium", type = "multiple_choice", context = "", language = "en" } = config

  try {
    console.log(`🤖 Generating ${count} ${difficulty} ${type} questions about: ${topic}`)

    // This is a mock implementation
    // In production, integrate with OpenAI, Google Gemini, Claude, etc.
    const prompt = `Generate ${count} ${difficulty} level ${type} questions about ${topic}. ${context ? `Context: ${context}` : ""}`

    const questions = await generateQuestions(prompt, count, type)

    // Add AI-specific metadata
    questions.forEach((question) => {
      question.ai_generated = true
      question.ai_config = config
      question.generated_at = new Date().toISOString()
      question.difficulty_level = difficulty
    })

    return questions
  } catch (error) {
    console.error("❌ Error generating questions with AI:", error)
    throw error
  }
}

/**
 * Analyze question quality
 * @param {Array} questions - Questions to analyze
 * @returns {Array} Quality analysis for each question
 */
export const analyzeQuestionQuality = (questions) => {
  return questions.map((question) => {
    const analysis = {
      score: 0,
      issues: [],
      suggestions: [],
      strengths: [],
    }

    // Check question text quality
    if (question.question_text.length < 10) {
      analysis.issues.push("Question text is too short")
    } else if (question.question_text.length > 200) {
      analysis.issues.push("Question text might be too long")
    } else {
      analysis.strengths.push("Question text has appropriate length")
      analysis.score += 20
    }

    // Check for clear language
    if (question.question_text.includes("?")) {
      analysis.strengths.push("Question is properly formatted with question mark")
      analysis.score += 10
    } else {
      analysis.suggestions.push("Consider adding a question mark for clarity")
    }

    // Check options for multiple choice
    if (question.question_type === "multiple_choice") {
      if (question.options && question.options.length >= 3) {
        analysis.strengths.push("Has sufficient answer options")
        analysis.score += 20
      } else {
        analysis.issues.push("Multiple choice questions should have at least 3 options")
      }

      if (question.options && question.options.includes(question.correct_answer)) {
        analysis.strengths.push("Correct answer is included in options")
        analysis.score += 20
      } else {
        analysis.issues.push("Correct answer must be one of the options")
      }
    }

    // Check explanation
    if (question.explanation && question.explanation.length > 20) {
      analysis.strengths.push("Has detailed explanation")
      analysis.score += 15
    } else {
      analysis.suggestions.push("Consider adding a more detailed explanation")
    }

    // Check marks
    if (question.marks && question.marks > 0) {
      analysis.strengths.push("Has valid marks assigned")
      analysis.score += 10
    } else {
      analysis.suggestions.push("Assign appropriate marks for the question")
    }

    // Check tags
    if (question.tags && question.tags.length > 0) {
      analysis.strengths.push("Has categorization tags")
      analysis.score += 5
    } else {
      analysis.suggestions.push("Add tags for better categorization")
    }

    // Determine overall quality
    if (analysis.score >= 80) {
      analysis.quality = "excellent"
    } else if (analysis.score >= 60) {
      analysis.quality = "good"
    } else if (analysis.score >= 40) {
      analysis.quality = "fair"
    } else {
      analysis.quality = "poor"
    }

    return analysis
  })
}
