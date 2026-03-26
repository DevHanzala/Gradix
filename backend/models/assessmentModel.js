import { findResourceById } from "./resourceModel.js";
import { mapLanguageCode } from "../services/ai/aiService.js";
import { generateContent } from "../services/ai/generateContent.js";
import * as assessmentRepo from "../repositories/assessmentRepository.js";
import { validateAssessmentData, validateQuestionBlockData } from "../validator/assessment.validator.js";

// ==================== ASSESSMENT CRUD ====================

export const createAssessment = async (assessmentData) => {
  try {
  
    const validationErrors = validateAssessmentData(assessmentData);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    const assessment = await assessmentRepo.createAssessmentQuery(assessmentData);
    return assessment;

  } catch (error) {
    console.error("❌ Error creating assessment:", error);
    throw error;
  }
};


export const getAssessmentsByInstructor = async (instructorId) => {
  try {
    const rows = await assessmentRepo.findAssessmentsByInstructorQuery(instructorId);
    return rows.map((row) => ({
      ...row,
      question_blocks: row.question_blocks || [],
      resources: row.resources || [],
      external_links: row.external_links || [],
    }));
  } catch (error) {
    console.error("❌ Error fetching assessments:", error);
    throw error;
  }
};

export const getAssessmentById = async (assessment_id, user_id, user_role) => {
  try {
    if (!assessment_id || isNaN(parseInt(assessment_id))) {
      throw new Error("Invalid assessment ID");
    }
    
    const id = parseInt(assessment_id);
    let result;
    
    if (user_role === "instructor" || user_role === "admin" || user_role === "super_admin") {
      result = await assessmentRepo.findAssessmentByIdForInstructorQuery(id, user_id);
    } else {
      result = await assessmentRepo.findAssessmentByIdForStudentQuery(id, user_id);
    }
    
    if (!result) {
      return null;
    }
    
    return {
      ...result,
      external_links: result.external_links || [],
      question_blocks: result.question_blocks || [],
      resources: result.resources || [],
    };
  } catch (error) {
    console.error("❌ Error in getAssessmentById:", error);
    throw error;
  }
};

export const updateAssessment = async (assessmentId, updateData) => {
  try {
    
    // VALIDATE DATA BEFORE UPDATING
    const validationErrors = validateAssessmentData(updateData);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    const assessment = await assessmentRepo.updateAssessmentQuery(assessmentId, updateData);
    
    if (!assessment) {
      throw new Error("Assessment not found");
    }
    
    return assessment;
  } catch (error) {
    console.error("DEBUG: Model updateAssessment - Error:", error);
    throw error;
  }
};

export const deleteAssessment = async (assessmentId) => {
  try {
    const assessment = await assessmentRepo.deleteAssessmentQuery(assessmentId);
    if (!assessment) {
      throw new Error("Assessment not found");
    }
  } catch (error) {
    console.error("❌ Error deleting assessment:", error);
    throw error;
  }
};

// ==================== QUESTION BLOCKS ====================

export const storeQuestionBlocks = async (assessmentId, questionBlocks, instructorId) => {
  try {
    // 🔹 Parse if it's a string
    if (typeof questionBlocks === "string") {
      try {
        questionBlocks = JSON.parse(questionBlocks);
      } catch (err) {
        throw new Error("Invalid question blocks format");
      }
    }

    // 🔹 Now normalize and validate each block
    for (const block of questionBlocks) {
      const typeMap = {
        multipleChoice: "multiple_choice",
        trueFalse: "true_false",
        shortAnswer: "short_answer",
      };
      if (typeMap[block.question_type]) {
        block.question_type = typeMap[block.question_type];
      }

      block.question_count = parseInt(block.question_count, 10);
      block.duration_per_question = parseInt(block.duration_per_question, 10);
      if (block.num_options !== null && block.num_options !== undefined) {
        block.num_options = parseInt(block.num_options, 10);
      }

      const validationErrors = validateQuestionBlockData(block);
      if (validationErrors.length > 0) {
        throw new Error(
          `Question block validation failed: ${validationErrors.join(', ')}`
        );
      }
    }

    await assessmentRepo.deleteQuestionBlocksByAssessmentQuery(assessmentId);

    for (const block of questionBlocks) {
      await assessmentRepo.createQuestionBlockQuery({
        assessmentId,
        question_type: block.question_type,
        question_count: block.question_count,
        duration_per_question: block.duration_per_question,
        num_options: block.num_options,
        positive_marks: block.positive_marks,
        negative_marks: block.negative_marks,
        instructorId,
      });
    }

  } catch (error) {
    console.error("❌ Error storing question blocks:", error);
    throw error;
  }
};

// ==================== ENROLLMENTS ====================

export const enrollStudent = async (assessmentId, email) => {
  try {
    const student = await assessmentRepo.findUserByEmailQuery(email);
    if (!student) {
      throw new Error("Student not found");
    }
    if (student.role !== "student") {
      throw new Error("User is not a student");
    }

    const existing = await assessmentRepo.findEnrollmentQuery(assessmentId, student.id);
    if (existing) {
      throw new Error("Student already enrolled");
    }

    const enrollment = await assessmentRepo.createEnrollmentQuery(assessmentId, student.id);
    return enrollment;
  } catch (error) {
    console.error("❌ Error enrolling student:", error);
    throw error;
  }
};

export const unenrollStudent = async (assessmentId, studentId) => {
  try {
    const enrollment = await assessmentRepo.deleteEnrollmentQuery(assessmentId, studentId);
    if (!enrollment) {
      throw new Error("Enrollment not found");
    }
    return enrollment;
  } catch (error) {
    console.error("❌ Error unenrolling student:", error);
    throw error;
  }
};

export const getEnrolledStudents = async (assessmentId) => {
  try {
    const students = await assessmentRepo.findEnrolledStudentsQuery(assessmentId);
    return students;
  } catch (error) {
    console.error("❌ Error fetching enrolled students:", error);
    throw error;
  }
};

// ==================== RESOURCE CHUNKS ====================

export const storeResourceChunk = async (resourceId, chunkText, embedding, metadata) => {
  try {
    const chunk = await assessmentRepo.createResourceChunkQuery({
      resourceId,
      chunkText,
      embedding,
      chunkIndex: metadata.chunk_index,
    });
    return chunk;
  } catch (error) {
    console.error("❌ Error storing resource chunk:", error);
    throw error;
  }
};

// ==================== ASSESSMENT RESOURCES ====================

export const linkResourceToAssessment = async (assessmentId, resourceId) => {
  try {
    const resource = await findResourceById(resourceId);
    if (!resource) {
      throw new Error("Resource not found");
    }

    const link = await assessmentRepo.linkResourceToAssessmentQuery(assessmentId, resourceId);
    return link;
  } catch (error) {
    console.error("❌ Error linking resource to assessment:", error);
    throw error;
  }
};

export const clearLinksForAssessment = async (assessmentId) => {
  try {
    const success = await assessmentRepo.clearExternalLinksQuery(assessmentId);
    if (!success) {
      throw new Error("Assessment not found");
    }
    return true;
  } catch (error) {
    console.error("❌ Error clearing links for assessment:", error);
    throw error;
  }
};

// ==================== AI QUESTION GENERATION ====================

export const generateAssessmentQuestions = async (assessmentId, attemptId, language, assessment) => {
  const langName = mapLanguageCode(language);
  

  // STEP 1: Fetch blocks
  const blockRows = await assessmentRepo.findQuestionBlocksByAssessmentQuery(assessmentId);

  if (blockRows.length === 0) {
    throw new Error(`No question blocks for assessment ${assessmentId}`);
  }


  const questionTypes = [...new Set(blockRows.map((b) => b.question_type))];
  const typeCountsStr = blockRows
    .map((b) => {
      if (b.question_type === "multiple_choice") {
        return `${b.question_count} multiple_choice (${b.num_options} options)`;
      }
      return `${b.question_count} ${b.question_type}`;
    })
    .join(", ");

  // STEP 2: Fetch resources
  const chunkRows = await assessmentRepo.findResourceChunksByAssessmentQuery(assessmentId);
  const resourcesContent = chunkRows
    .filter((row) => row.chunk_text)
    .map((row) => `Resource "${row.name}":\n${row.chunk_text}`)
    .join("\n\n---\n\n")
    .substring(0, 5000) || "No resource content available";

  

  const questionPrompt = `
CRITICAL: Generate ALL questions EXCLUSIVELY in ${langName} language. 
Every word MUST be in ${langName}.

CONTENT TO BASE QUESTIONS ON:
Title: "${assessment.title}"
Instructor Prompt: "${assessment.prompt || "No prompt provided"}"
External Links: ${(assessment.external_links || []).join(", ") || "None"}

Resource Content:
${resourcesContent}

STRICT REQUIREMENTS:
1. Question types: ${questionTypes.join(", ")}
2. Counts: ${typeCountsStr}
3. Language: ALL text in ${langName}
4. Output ONLY JSON array

Example format:
[
  {
    "question_type": "${questionTypes[0]}",
    "question_text": "[Question in ${langName}]",
    "options": ${questionTypes[0] === 'multiple_choice' ? '["A. [Option]", "B. [Option]"]' : questionTypes[0] === 'true_false' ? '["true", "false"]' : 'null'},
    "correct_answer": ${questionTypes[0] === 'true_false' ? 'true' : '"A. [Option]"'},
    "positive_marks": ${blockRows[0].positive_marks},
    "negative_marks": ${blockRows[0].negative_marks},
    "duration_per_question": ${blockRows[0].duration_per_question}
  }
]

Generate ${blockRows.reduce((sum, b) => sum + b.question_count, 0)} questions NOW in ${langName}.`;


  // STEP 3: Call AI
  let questions = [];
  try {
    const aiText = await generateContent(questionPrompt, {
      maxOutputTokens: 4000,
      temperature: 0.7,
      responseMimeType: "application/json",
    });


    const cleaned = aiText.trim().replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]") + 1;

    if (start === -1 || end === 0) {
      throw new Error("No JSON array in AI response");
    }

    questions = JSON.parse(cleaned.substring(start, end));

    
  } catch (error) {
    console.error('[QUESTION GEN] ❌ AI call failed:', error.message);
    throw error;
  }

  // STEP 4: Save to DB (only if attemptId exists)
  let totalDuration = 0;
  let questionIndex = 0;

  if (attemptId) {
    await assessmentRepo.deleteGeneratedQuestionsByAttemptQuery(attemptId);
  }

  for (const block of blockRows) {
    for (let i = 0; i < block.question_count && questionIndex < questions.length; i++) {
      let q = questions[questionIndex];

      q.question_type = block.question_type;
      q.positive_marks = block.positive_marks;
      q.negative_marks = block.negative_marks;
      q.duration_per_question = block.duration_per_question;

      if (!q.question_text) {
        questionIndex++;
        continue;
      }

      if (q.question_type === "multiple_choice" && q.options && q.correct_answer) {
        const letter = String(q.correct_answer).trim().toUpperCase();
        const key = Object.keys(q.options).find((k) =>
          k.trim().toUpperCase().startsWith(letter)
        );
        if (key) {
          q.correct_answer = `${key}. ${q.options[key]}`;
        }
      }

      totalDuration += q.duration_per_question;

      if (attemptId) {
        await assessmentRepo.createGeneratedQuestionQuery({
          attemptId,
          questionOrder: questionIndex + 1,
          questionType: q.question_type,
          questionText: q.question_text.trim(),
          options: q.options,
          correctAnswer: q.correct_answer,
          positiveMarks: q.positive_marks,
          negativeMarks: q.negative_marks,
          durationPerQuestion: q.duration_per_question,
        });
      }

      questionIndex++;
    }
  }


  return { questions, duration: totalDuration };
};