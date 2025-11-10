import pool from "../DB/db.js"

/**
 * Auto-grading Service
 * Handles automated grading for different question types:
 * - MCQ/True-False: Automatic grading
 * - Short-answer/Essay: Rubric-based grading with instructor override
 */

/**
 * Grade a complete assessment attempt
 * @param {number} attemptId - Assessment attempt ID
 * @returns {Promise<Object>} Grading results
 */
export const gradeAssessmentAttempt = async (attemptId) => {
  try {
    console.log(`📊 Starting auto-grading for attempt ${attemptId}`)

    // Get attempt details
    const attempt = await getAttemptDetails(attemptId)
    if (!attempt) {
      throw new Error("Attempt not found")
    }

    // Get all questions and student answers for this attempt
    const questionsAndAnswers = await getQuestionsAndAnswers(attemptId)
    
    let totalMarks = 0
    let scoredMarks = 0
    let autoGradedCount = 0
    let manualGradingRequired = 0
    const gradingResults = []

    // Grade each question
    for (const qa of questionsAndAnswers) {
      const gradingResult = await gradeQuestion(qa)
      gradingResults.push(gradingResult)

      totalMarks += qa.marks
      scoredMarks += gradingResult.scored_marks

      if (gradingResult.grading_method === 'auto') {
        autoGradedCount++
      } else {
        manualGradingRequired++
      }
    }

    // Calculate percentage
    const percentage = totalMarks > 0 ? Math.round((scoredMarks / totalMarks) * 100) : 0

    // Update attempt with grading results
    await updateAttemptGrading(attemptId, {
      total_marks: totalMarks,
      scored_marks: scoredMarks,
      percentage: percentage,
      auto_graded_count: autoGradedCount,
      manual_grading_required: manualGradingRequired,
      grading_status: manualGradingRequired > 0 ? 'partially_graded' : 'fully_graded'
    })

    console.log(`✅ Assessment graded successfully. Score: ${scoredMarks}/${totalMarks} (${percentage}%)`)

    return {
      attempt_id: attemptId,
      total_marks,
      scored_marks,
      percentage,
      auto_graded_count: autoGradedCount,
      manual_grading_required,
      grading_status: manualGradingRequired > 0 ? 'partially_graded' : 'fully_graded',
      grading_results: gradingResults
    }

  } catch (error) {
    console.error("❌ Auto-grading error:", error)
    throw error
  }
}

/**
 * Grade a single question
 * @param {Object} questionAnswer - Question and answer data
 * @returns {Promise<Object>} Grading result
 */
const gradeQuestion = async (questionAnswer) => {
  const {
    question_id,
    question_type,
    correct_answer,
    expected_answer,
    rubric,
    marks,
    student_answer,
    selected_options
  } = questionAnswer

  let scoredMarks = 0
  let gradingMethod = 'auto'
  let feedback = ''
  let gradingNotes = ''

  try {
    switch (question_type) {
      case 'multiple_choice':
        const mcqResult = gradeMultipleChoice(selected_options, correct_answer, marks)
        scoredMarks = mcqResult.scored_marks
        feedback = mcqResult.feedback
        gradingMethod = 'auto'
        break

      case 'true_false':
        const tfResult = gradeTrueFalse(student_answer, correct_answer, marks)
        scoredMarks = tfResult.scored_marks
        feedback = tfResult.feedback
        gradingMethod = 'auto'
        break

      case 'short_answer':
        const saResult = await gradeShortAnswer(student_answer, expected_answer, rubric, marks)
        scoredMarks = saResult.scored_marks
        feedback = saResult.feedback
        gradingMethod = saResult.grading_method
        gradingNotes = saResult.grading_notes
        break

      case 'essay':
        const essayResult = await gradeEssay(student_answer, rubric, marks)
        scoredMarks = essayResult.scored_marks
        feedback = essayResult.feedback
        gradingMethod = essayResult.grading_method
        gradingNotes = essayResult.grading_notes
        break

      default:
        scoredMarks = 0
        feedback = 'Question type not supported for auto-grading'
        gradingMethod = 'manual'
    }

    // Save grading result
    await saveGradingResult(questionAnswer.answer_id, {
      scored_marks,
      grading_method: gradingMethod,
      feedback,
      grading_notes: gradingNotes,
      graded_at: new Date()
    })

    return {
      question_id,
      question_type,
      total_marks: marks,
      scored_marks,
      grading_method: gradingMethod,
      feedback,
      grading_notes: gradingNotes
    }

  } catch (error) {
    console.error(`❌ Error grading question ${question_id}:`, error)
    
    // Mark for manual grading if auto-grading fails
    await saveGradingResult(questionAnswer.answer_id, {
      scored_marks: 0,
      grading_method: 'manual',
      feedback: 'Auto-grading failed - requires manual review',
      grading_notes: `Error: ${error.message}`,
      graded_at: new Date()
    })

    return {
      question_id,
      question_type,
      total_marks: marks,
      scored_marks: 0,
      grading_method: 'manual',
      feedback: 'Auto-grading failed - requires manual review',
      grading_notes: `Error: ${error.message}`
    }
  }
}

/**
 * Grade multiple choice question
 * @param {Array} selectedOptions - Student's selected options
 * @param {string} correctAnswer - Correct answer
 * @param {number} marks - Total marks for question
 * @returns {Object} Grading result
 */
const gradeMultipleChoice = (selectedOptions, correctAnswer, marks) => {
  if (!selectedOptions || selectedOptions.length === 0) {
    return {
      scored_marks: 0,
      feedback: 'No answer provided'
    }
  }

  // Check if correct answer is in selected options
  const isCorrect = selectedOptions.includes(correctAnswer)
  
  return {
    scored_marks: isCorrect ? marks : 0,
    feedback: isCorrect ? 'Correct answer' : `Incorrect. Correct answer was: ${correctAnswer}`
  }
}

/**
 * Grade true/false question
 * @param {string} studentAnswer - Student's answer
 * @param {string} correctAnswer - Correct answer
 * @param {number} marks - Total marks for question
 * @returns {Object} Grading result
 */
const gradeTrueFalse = (studentAnswer, correctAnswer, marks) => {
  if (!studentAnswer) {
    return {
      scored_marks: 0,
      feedback: 'No answer provided'
    }
  }

  const isCorrect = studentAnswer.toLowerCase() === correctAnswer.toLowerCase()
  
  return {
    scored_marks: isCorrect ? marks : 0,
    feedback: isCorrect ? 'Correct answer' : `Incorrect. Correct answer was: ${correctAnswer}`
  }
}

/**
 * Grade short answer question using rubric
 * @param {string} studentAnswer - Student's answer
 * @param {string} expectedAnswer - Expected answer key points
 * @param {Object} rubric - Grading rubric
 * @param {number} marks - Total marks for question
 * @returns {Promise<Object>} Grading result
 */
const gradeShortAnswer = async (studentAnswer, expectedAnswer, rubric, marks) => {
  if (!studentAnswer || studentAnswer.trim().length === 0) {
    return {
      scored_marks: 0,
      feedback: 'No answer provided',
      grading_method: 'auto'
    }
  }

  // If no rubric provided, use simple keyword matching
  if (!rubric) {
    return gradeByKeywordMatching(studentAnswer, expectedAnswer, marks)
  }

  // Parse rubric and apply scoring
  try {
    const rubricData = typeof rubric === 'string' ? JSON.parse(rubric) : rubric
    return applyRubricGrading(studentAnswer, rubricData, marks)
  } catch (error) {
    console.warn(`⚠️ Invalid rubric format for question, falling back to keyword matching: ${error.message}`)
    return gradeByKeywordMatching(studentAnswer, expectedAnswer, marks)
  }
}

/**
 * Grade essay question using rubric
 * @param {string} studentAnswer - Student's answer
 * @param {Object} rubric - Grading rubric
 * @param {number} marks - Total marks for question
 * @returns {Promise<Object>} Grading result
 */
const gradeEssay = async (studentAnswer, rubric, marks) => {
  if (!studentAnswer || studentAnswer.trim().length === 0) {
    return {
      scored_marks: 0,
      feedback: 'No answer provided',
      grading_method: 'manual'
    }
  }

  // Essays always require manual grading or detailed rubric
  if (!rubric) {
    return {
      scored_marks: 0,
      feedback: 'Essay requires manual grading',
      grading_method: 'manual',
      grading_notes: 'No rubric provided for essay grading'
    }
  }

  try {
    const rubricData = typeof rubric === 'string' ? JSON.parse(rubric) : rubric
    return applyRubricGrading(studentAnswer, rubricData, marks)
  } catch (error) {
    return {
      scored_marks: 0,
      feedback: 'Essay requires manual grading',
      grading_method: 'manual',
      grading_notes: `Rubric parsing failed: ${error.message}`
    }
  }
}

/**
 * Grade by keyword matching (fallback method)
 * @param {string} studentAnswer - Student's answer
 * @param {string} expectedAnswer - Expected answer key points
 * @param {number} marks - Total marks for question
 * @returns {Object} Grading result
 */
const gradeByKeywordMatching = (studentAnswer, expectedAnswer, marks) => {
  if (!expectedAnswer) {
    return {
      scored_marks: 0,
      feedback: 'No expected answer provided for comparison',
      grading_method: 'manual'
    }
  }

  const studentWords = studentAnswer.toLowerCase().split(/\s+/)
  const expectedWords = expectedAnswer.toLowerCase().split(/\s+/)
  
  let matchedWords = 0
  for (const word of expectedWords) {
    if (studentWords.includes(word)) {
      matchedWords++
    }
  }

  const matchPercentage = expectedWords.length > 0 ? matchedWords / expectedWords.length : 0
  const scoredMarks = Math.round(matchPercentage * marks)

  return {
    scored_marks,
    feedback: `Keyword matching: ${Math.round(matchPercentage * 100)}% (${matchedWords}/${expectedWords.length} key terms)`,
    grading_method: 'auto'
  }
}

/**
 * Apply rubric-based grading
 * @param {string} studentAnswer - Student's answer
 * @param {Object} rubric - Grading rubric
 * @param {number} marks - Total marks for question
 * @returns {Object} Grading result
 */
const applyRubricGrading = (studentAnswer, rubric, marks) => {
  let totalScore = 0
  let maxPossibleScore = 0
  const feedback = []
  const gradingNotes = []

  // Apply each rubric criterion
  for (const criterion of rubric.criteria || []) {
    const { name, max_marks, keywords, description } = criterion
    maxPossibleScore += max_marks

    let criterionScore = 0
    let criterionFeedback = ''

    if (keywords && keywords.length > 0) {
      // Check for keyword presence
      const studentWords = studentAnswer.toLowerCase().split(/\s+/)
      let keywordMatches = 0
      
      for (const keyword of keywords) {
        if (studentWords.includes(keyword.toLowerCase())) {
          keywordMatches++
        }
      }

      criterionScore = Math.round((keywordMatches / keywords.length) * max_marks)
      criterionFeedback = `${name}: ${keywordMatches}/${keywords.length} keywords found`
    } else if (description) {
      // Simple length/content scoring
      const answerLength = studentAnswer.length
      const minLength = 50 // Minimum expected length
      
      if (answerLength >= minLength) {
        criterionScore = Math.round((answerLength / minLength) * max_marks)
        criterionScore = Math.min(criterionScore, max_marks) // Cap at max marks
        criterionFeedback = `${name}: Good length and content`
      } else {
        criterionScore = Math.round((answerLength / minLength) * max_marks)
        criterionFeedback = `${name}: Answer too short, expected at least ${minLength} characters`
      }
    }

    totalScore += criterionScore
    feedback.push(criterionFeedback)
    gradingNotes.push(`${name}: ${criterionScore}/${max_marks}`)
  }

  return {
    scored_marks: totalScore,
    feedback: feedback.join('; '),
    grading_method: 'auto',
    grading_notes: gradingNotes.join('; ')
  }
}

/**
 * Get attempt details
 * @param {number} attemptId - Attempt ID
 * @returns {Promise<Object>} Attempt details
 */
const getAttemptDetails = async (attemptId) => {
  const result = await pool.query(
    "SELECT * FROM assessment_attempts WHERE id = $1",
    [attemptId]
  )
  return result.rows[0] || null
}

/**
 * Get questions and answers for an attempt
 * @param {number} attemptId - Attempt ID
 * @returns {Promise<Array>} Questions and answers
 */
const getQuestionsAndAnswers = async (attemptId) => {
  const result = await pool.query(
    `SELECT 
      q.id as question_id,
      q.question_type,
      q.question_text,
      q.correct_answer,
      q.expected_answer,
      q.rubric,
      q.marks,
      sa.id as answer_id,
      sa.answer_text,
      sa.selected_options
    FROM student_answers sa
    JOIN questions q ON sa.question_id = q.id
    WHERE sa.attempt_id = $1
    ORDER BY q.question_number`,
    [attemptId]
  )
  return result.rows
}

/**
 * Save grading result for a question
 * @param {number} answerId - Student answer ID
 * @param {Object} gradingData - Grading data
 */
const saveGradingResult = async (answerId, gradingData) => {
  await pool.query(
    `UPDATE student_answers 
     SET scored_marks = $1, 
         grading_method = $2, 
         feedback = $3, 
         grading_notes = $4, 
         graded_at = $5
     WHERE id = $6`,
    [
      gradingData.scored_marks,
      gradingData.grading_method,
      gradingData.feedback,
      gradingData.grading_notes,
      gradingData.graded_at,
      answerId
    ]
  )
}

/**
 * Update attempt with grading results
 * @param {number} attemptId - Attempt ID
 * @param {Object} gradingData - Overall grading data
 */
const updateAttemptGrading = async (attemptId, gradingData) => {
  await pool.query(
    `UPDATE assessment_attempts 
     SET total_marks = $1, 
         scored_marks = $2, 
         percentage = $3,
         auto_graded_count = $4,
         manual_grading_required = $5,
         grading_status = $6,
         graded_at = NOW()
     WHERE id = $7`,
    [
      gradingData.total_marks,
      gradingData.scored_marks,
      gradingData.percentage,
      gradingData.auto_graded_count,
      gradingData.manual_grading_required,
      gradingData.grading_status,
      attemptId
    ]
  )
}

/**
 * Get questions requiring manual grading
 * @param {number} assessmentId - Assessment ID
 * @returns {Promise<Array>} Questions requiring manual grading
 */
export const getQuestionsRequiringManualGrading = async (assessmentId) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT
        q.id as question_id,
        q.question_text,
        q.question_type,
        q.marks,
        COUNT(sa.id) as pending_answers
      FROM questions q
      JOIN student_answers sa ON q.id = sa.question_id
      JOIN assessment_attempts aa ON sa.attempt_id = aa.id
      WHERE aa.assessment_id = $1 
        AND sa.grading_method = 'manual'
        AND aa.grading_status != 'fully_graded'
      GROUP BY q.id, q.question_text, q.question_type, q.marks
      ORDER BY q.question_number`,
      [assessmentId]
    )
    
    return result.rows
  } catch (error) {
    console.error("❌ Error getting questions requiring manual grading:", error)
    return []
  }
}

/**
 * Override auto-graded result (instructor override)
 * @param {number} answerId - Student answer ID
 * @param {number} newScore - New score
 * @param {string} feedback - Instructor feedback
 * @param {string} overrideReason - Reason for override
 * @param {number} instructorId - Instructor ID
 */
export const overrideGrading = async (answerId, newScore, feedback, overrideReason, instructorId) => {
  try {
    await pool.query(
      `UPDATE student_answers 
       SET scored_marks = $1, 
           feedback = $2, 
           grading_method = 'manual_override',
           grading_notes = $3,
           overridden_by = $4,
           overridden_at = NOW()
       WHERE id = $5`,
      [newScore, feedback, overrideReason, instructorId, answerId]
    )

    console.log(`✅ Grading overridden for answer ${answerId} by instructor ${instructorId}`)
  } catch (error) {
    console.error("❌ Error overriding grading:", error)
    throw error
  }
}
