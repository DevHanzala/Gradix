import { findResourceById } from "./resourceModel.js";
import { mapLanguageCode } from "../services/ai/aiService.js";
import { generateContent } from "../services/ai/generateContent.js";
import * as assessmentRepo from "../repositories/assessmentRepository.js";
import { validateAssessmentData, validateQuestionBlockData } from "../validator/assessment.validator.js";
import {
  normalizeOptions,
  normalizeText,
  canonicalOption,
  parseBoolean,
  parseShortAnswerRule,
} from "../utils/grading.js";

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

const TYPE_INSTRUCTIONS = {
  multiple_choice: (n) =>
    `"options": an array of exactly ${n} plain option texts WITHOUT letter labels; ` +
    `"correct_answer": the exact text of the correct option.`,
  true_false: () => `"options": null; "correct_answer": a JSON boolean (true or false).`,
  short_answer: () =>
    `"options": null; "correct_answer": {"answer": "model answer", ` +
    `"required_keywords": ["2-4 essential keywords"], "min_required_match": 1}.`,
};

const buildQuestionPrompt = ({ assessment, blockRows, langName, resourcesContent }) => {
  const total = blockRows.reduce((sum, b) => sum + b.question_count, 0);
  const blocksText = blockRows
    .map(
      (b) =>
        `- ${b.question_count} x "${b.question_type}": ` +
        TYPE_INSTRUCTIONS[b.question_type](b.num_options || 4)
    )
    .join("\n");

  return `You are writing exam questions.
Write every word of every question and option natively in ${langName}. Do not translate from another language.

CONTENT TO BASE QUESTIONS ON
Title: "${assessment.title}"
Instructor prompt: "${assessment.prompt || "No prompt provided"}"
External links (titles only, not fetched): ${(assessment.external_links || []).join(", ") || "None"}

Resource content:
${resourcesContent}

REQUIRED QUESTIONS (${total} in total)
${blocksText}

OUTPUT
Return ONLY a JSON array. Each element:
{"question_type": "<one of the types above>", "question_text": "...", "options": ..., "correct_answer": ...}
No markdown, no commentary.`;
};

const parseQuestionArray = (aiText) => {
  const cleaned = String(aiText || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end <= start) throw new Error("No JSON array in AI response");
  const parsed = JSON.parse(cleaned.substring(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error("AI response is not an array");
  return parsed;
};

/**
 * Validate one raw AI question against its block and convert it to the
 * canonical stored shape. Returns null if the question is unusable.
 */
export const normalizeGeneratedQuestion = (raw, block) => {
  if (!raw || typeof raw.question_text !== "string" || !raw.question_text.trim()) return null;

  const base = {
    question_type: block.question_type,
    question_text: raw.question_text.trim(),
    positive_marks: Number(block.positive_marks ?? 1),
    negative_marks: Math.abs(Number(block.negative_marks ?? 0)),
    duration_per_question: Number(block.duration_per_question) || 120,
  };

  if (block.question_type === "multiple_choice") {
    const options = normalizeOptions(raw.options).filter((o) => o.length > 0);
    if (options.length < 2 || new Set(options.map(normalizeText)).size !== options.length) return null;
    const correct = canonicalOption(raw.correct_answer, options);
    if (correct === null) return null;
    return { ...base, options, correct_answer: correct };
  }

  if (block.question_type === "true_false") {
    const correct = parseBoolean(raw.correct_answer);
    if (correct === null) return null;
    return { ...base, options: null, correct_answer: correct };
  }

  if (block.question_type === "short_answer") {
    const rule = parseShortAnswerRule(raw.correct_answer);
    if (!rule.answer && rule.keywords.length === 0) return null;
    return {
      ...base,
      options: null,
      correct_answer: {
        answer: rule.answer,
        required_keywords: rule.keywords,
        min_required_match: rule.keywords.length ? Math.max(1, rule.minMatch) : 0,
      },
    };
  }

  return null;
};

/** Fill each block from AI questions of the same type, preserving block order. */
const assignToBlocks = (rawQuestions, blockRows) => {
  const buckets = new Map();
  for (const q of rawQuestions) {
    const type = typeof q?.question_type === "string" ? q.question_type.trim() : "";
    if (!buckets.has(type)) buckets.set(type, []);
    buckets.get(type).push(q);
  }

  const result = [];
  for (const block of blockRows) {
    const pool = buckets.get(block.question_type) || [];
    const accepted = [];
    while (accepted.length < block.question_count && pool.length > 0) {
      const normalized = normalizeGeneratedQuestion(pool.shift(), block);
      if (normalized) accepted.push(normalized);
    }
    result.push(accepted);
  }
  return result;
};

/**
 * Generate a question set for an assessment in `language`.
 * Pure with respect to the database: it reads blocks/resources but writes
 * nothing, so callers decide whether and where to persist the questions.
 * Returns { questions, duration } where duration is the total in seconds.
 */
export const generateAssessmentQuestions = async (assessmentId, language, assessment) => {
  const langName = mapLanguageCode(language);

  const blockRows = await assessmentRepo.findQuestionBlocksByAssessmentQuery(assessmentId);
  if (blockRows.length === 0) {
    throw new Error("NO_QUESTION_BLOCKS");
  }

  const chunkRows = await assessmentRepo.findResourceChunksByAssessmentQuery(assessmentId);
  const resourcesContent =
    chunkRows
      .filter((row) => row.chunk_text)
      .map((row) => `Resource "${row.name}":\n${row.chunk_text}`)
      .join("\n\n---\n\n")
      .substring(0, 5000) || "No resource content available";

  const prompt = buildQuestionPrompt({ assessment, blockRows, langName, resourcesContent });

  // One retry when the model returns too few usable questions.
  let perBlock = blockRows.map(() => []);
  for (let attempt = 0; attempt < 2; attempt++) {
    let rawQuestions;
    try {
      const aiText = await generateContent(prompt, {
        maxOutputTokens: 8000,
        temperature: 0.8,
        responseMimeType: "application/json",
      });
      rawQuestions = parseQuestionArray(aiText);
    } catch (error) {
      console.error(`[QUESTION GEN] attempt ${attempt + 1} failed: ${error.message}`);
      continue;
    }

    const fresh = assignToBlocks(rawQuestions, blockRows);
    perBlock = perBlock.map((existing, i) =>
      existing.concat(fresh[i]).slice(0, blockRows[i].question_count)
    );
    const complete = perBlock.every((qs, i) => qs.length >= blockRows[i].question_count);
    if (complete) break;
  }

  const questions = perBlock.flat();
  if (questions.length === 0) {
    throw new Error("GENERATION_FAILED");
  }

  const duration = questions.reduce((sum, q) => sum + q.duration_per_question, 0);
  return { questions, duration };
};
