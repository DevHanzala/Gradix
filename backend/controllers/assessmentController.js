// IMPORT ASSESSMENT MODEL FUNCTIONS
import {
  createAssessment,
  storeQuestionBlocks,
  getAssessmentsByInstructor,
  getAssessmentById,
  updateAssessment,
  deleteAssessment,
  enrollStudent,
  unenrollStudent,
  getEnrolledStudents,
  generateAssessmentQuestions,
  storeResourceChunk,
} from '../models/assessmentModel.js';
import { generateContent } from '../services/ai/generateContent.js';
import { findUserByEmail } from '../models/userModel.js';
import { createResource, linkResourceToAssessment } from '../models/resourceModel.js';
import { uploadResource } from './resourceController.js';
import { sendAssessmentEnrollmentEmail } from '../services/emailService.js';
import { extractTextFromFile, chunkText } from '../services/textProcessor.js';
import { generateEmbedding } from '../services/embeddingGenerator.js';

// IMPORT REDIS INSTANCE
import { redis } from "../services/redis.js";
import pool from '../DB/db.js';

//Create New Assessment
export const createNewAssessment = async (req, res) => {
  try {
    const {
      title,
      prompt,
      externalLinks,
      question_blocks,
      selected_resources = [],
    } = req.body;

    const instructor_id = req.user.id;
    const new_files = req.files?.new_files || [];

    // === TITLE IS ALWAYS REQUIRED ===
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Assessment Title is required",
      });
    }

    // === CHECK IF USER PROVIDED ANY SOURCE (files, links, or selected resources) ===
    const hasFiles = new_files.length > 0;
    const hasLinks = Array.isArray(externalLinks) && externalLinks.some(l => l && l.trim());
    const hasSelectedResources = selected_resources.length > 0;
    const hasAnySource = hasFiles || hasLinks || hasSelectedResources;

    // === PROMPT LOGIC: REQUIRED ONLY IF NO SOURCE IS PROVIDED ===
    if (!hasAnySource && (!prompt || !prompt.trim())) {
      return res.status(400).json({
        success: false,
        message: "Prompt is required when no resources or links are provided",
      });
    }

    // === IF SOURCE EXISTS → PROMPT IS OPTIONAL (even if empty) ===
    // So we allow prompt = null or empty string if files/links exist

    // Validate question blocks (same as before)
    if (question_blocks && Array.isArray(question_blocks) && question_blocks.length > 0) {
      for (const block of question_blocks) {
        if (!block.question_count || block.question_count < 1) {
          return res.status(400).json({ success: false, message: "Question count must be at least 1" });
        }
        if (!block.duration_per_question || block.duration_per_question < 30) {
          return res.status(400).json({ success: false, message: "Duration per question must be at least 30 seconds" });
        }
        if (block.question_type === "multiple_choice" && (!block.num_options || block.num_options < 2)) {
          return res.status(400).json({ success: false, message: "Multiple choice needs at least 2 options" });
        }
      }
    }

    // === FINAL DATA ===
    const assessmentData = {
      title: title.trim(),
      prompt: hasAnySource ? (prompt?.trim() || null) : prompt.trim(), // allow null if source exists
      external_links: hasLinks ? externalLinks.filter(link => link && link.trim()) : null,
      instructor_id,
      is_executed: false,
    };

    console.log("Creating assessment:", assessmentData);

    const newAssessment = await createAssessment(assessmentData);

    if (question_blocks?.length > 0) {
      await storeQuestionBlocks(newAssessment.id, question_blocks, instructor_id);
    }

    let newResourceIds = [];
    if (hasFiles) {
      const uploaded = await uploadResource({ files: new_files });
      newResourceIds = uploaded.map(r => r.id);
    }

    const allResourceIds = [...selected_resources.map(id => parseInt(id)), ...newResourceIds];
    for (const id of allResourceIds) {
      if (!isNaN(id)) await linkResourceToAssessment(newAssessment.id, id);
    }

    await redis.del(`instructor:assessments:${req.user.id}`);

    res.status(201).json({
      success: true,
      message: "Assessment created successfully",
      data: newAssessment,
    });
  } catch (error) {
    console.error("Create assessment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create assessment",
      error: error.message,
    });
  }
};

//Get Assessments for Instructor
export const getInstructorAssessments = async (req, res) => {
  try {
    const instructor_id = req.user.id;

    const cacheKey = `instructor:assessments:${instructor_id}`;

    // CHECK REDIS FIRST — INSTANT
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        message: 'Assessments retrieved successfully',
        data: cached,
      });
    }

    // IF NOT CACHED → GET FROM DB
    const assessments = await getAssessmentsByInstructor(instructor_id);

    // CACHE FOR 10 MINUTES
    await redis.set(cacheKey, assessments, { ex: 600 });

    res.status(200).json({
      success: true,
      message: 'Assessments retrieved successfully',
      data: assessments,
    });
  } catch (error) {
    console.error('Get assessments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve assessments',
    });
  }
};

//Get Single Assessment
export const getAssessment = async (req, res) => {
  try {
    const assessment_id = parseInt(req.params.id);
    const user_id = req.user.id;
    const user_role = req.user.role;

    if (isNaN(assessment_id)) {
      return res.status(400).json({ success: false, message: 'Invalid assessment ID' });
    }

    // REDIS CACHE KEY
    const cacheKey = `assessment:single:${assessment_id}:${user_id}`;

    // CHECK REDIS FIRST — INSTANT
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`Assessment ${assessment_id} from Redis cache`);
      return res.status(200).json({
        success: true,
        message: 'Assessment retrieved successfully',
        data: cached,
      });
    }

    console.log(`Fetching assessment ${assessment_id} from DB`);
    const assessment = await getAssessmentById(assessment_id, user_id, user_role);

    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found or access denied' });
    }

    // CACHE FOR 10 MINUTES
    await redis.set(cacheKey, assessment, { ex: 600 });

    res.status(200).json({
      success: true,
      message: 'Assessment retrieved successfully',
      data: assessment,
    });
  } catch (error) {
    console.error('Get assessment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve assessment',
    });
  }
};


//Update Assessment Data
export const updateAssessmentData = async (req, res) => {
  try {
    const assessment_id = req.params.id;
    const user_id = req.user.id;

    const title = req.body.title;
    const prompt = req.body.prompt;
    const externalLinks = req.body.externalLinks ? JSON.parse(req.body.externalLinks) : [];
    const question_blocks = req.body.question_blocks ? JSON.parse(req.body.question_blocks) : [];
    const selected_resources = req.body.selected_resources ? JSON.parse(req.body.selected_resources) : [];
    const new_files = req.files || [];

    if (!title?.trim()) return res.status(400).json({ success: false, message: 'Assessment Title is required' });

    const hasPrompt = prompt?.trim();
    const hasLinks = Array.isArray(externalLinks) && externalLinks.some(l => l?.trim());
    const hasResources = selected_resources.length > 0 || new_files.length > 0;

    if (!hasPrompt && !hasLinks && !hasResources) {
      return res.status(400).json({ success: false, message: 'You must provide either a Prompt, Resources, or External Links' });
    }

    const updateData = {
      title: title.trim(),
      prompt: hasPrompt ? prompt.trim() : null,
      external_links: hasLinks ? externalLinks.filter(l => l?.trim()) : null,
    };

    const updatedAssessment = await updateAssessment(parseInt(assessment_id), updateData);

    if (question_blocks.length > 0) {
      await storeQuestionBlocks(parseInt(assessment_id), question_blocks, user_id);
    }

    // CLEAR ALL OLD RESOURCE LINKS
    await pool.query(`DELETE FROM assessment_resources WHERE assessment_id = $1`, [assessment_id]);

    // LINK SELECTED EXISTING RESOURCES
    for (const resourceId of selected_resources) {
      if (!isNaN(parseInt(resourceId))) {
        await linkResourceToAssessment(assessment_id, parseInt(resourceId));
      }
    }

    // PROCESS NEW UPLOADED FILES
    for (const file of new_files) {
      const text = await extractTextFromFile(file.buffer, file.mimetype);
      const chunks = chunkText(text, 500);

      const resource = await createResource({
        name: file.originalname,
        file_type: file.mimetype,
        file_size: file.size,
        content_type: 'file',
        visibility: 'private',
        uploaded_by: user_id,
      });

      for (let i = 0; i < chunks.length; i++) {
        const embedding = await generateEmbedding(chunks[i]);
        await storeResourceChunk(resource.id, chunks[i], embedding, { chunk_index: i });
      }

      await linkResourceToAssessment(assessment_id, resource.id);
    }

    // FINAL CACHE CLEARING — PUT THIS AT THE END OF updateAssessmentData & deleteAssessmentData
    const instructorId = req.user.id;
    const assessmentId = parseInt(req.params.id || req.params.assessmentId);

    await redis.del(`instructor:assessments:${instructorId}`);
    await redis.del(`assessment:single:${assessmentId}:${instructorId}`);
    await redis.del(`assessment:single:${assessmentId}:*`);

    console.log(`All cache cleared for assessment ${assessmentId}`);
    res.status(200).json({
      success: true,
      message: 'Assessment updated successfully',
      data: updatedAssessment,
    });
  } catch (error) {
    console.error('Update assessment error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

//Delete Assessment Data
export const deleteAssessmentData = async (req, res) => {
  try {
    const assessment_id = req.params.id;
    const user_id = req.user.id;
    const user_role = req.user.role;

    if (!assessment_id || isNaN(parseInt(assessment_id))) {
      return res.status(400).json({ success: false, message: 'Invalid assessment ID' });
    }

    console.log(`🔄 Deleting assessment ${assessment_id} for user ${user_id} (${user_role})`);

    const assessment = await getAssessmentById(parseInt(assessment_id), user_id, user_role);
    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found or access denied' });
    }

    await deleteAssessment(parseInt(assessment_id));

    console.log(`✅ Assessment deleted: ID=${assessment_id}`);
    // FINAL CACHE CLEARING — PUT THIS AT THE END OF updateAssessmentData & deleteAssessmentData
    const instructorId = req.user.id;
    const assessmentId = parseInt(req.params.id || req.params.assessmentId);

    await redis.del(`instructor:assessments:${instructorId}`);
    await redis.del(`assessment:single:${assessmentId}:${instructorId}`);
    await redis.del(`assessment:single:${assessmentId}:*`);

    console.log(`All cache cleared for assessment ${assessmentId}`);
    res.status(200).json({
      success: true,
      message: 'Assessment deleted successfully',
    });
  } catch (error) {
    console.error('❌ Delete assessment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete assessment',
      error: error.message,
    });
  }
};

//Enroll Student to Assessment
export const enrollStudentController = async (req, res) => {
  try {
    const assessmentId = req.params.id;
    const { email } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log(`🔍 Validating enrollment for assessment ${assessmentId}, email: ${email}, user: ${userId} (${userRole})`);

    if (!assessmentId || isNaN(parseInt(assessmentId))) {
      console.warn(`⚠️ Invalid assessment ID: ${assessmentId}`);
      return res.status(400).json({ success: false, message: 'Invalid assessment ID' });
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      console.warn(`⚠️ Invalid email: ${email}`);
      return res.status(400).json({ success: false, message: 'Student email is required and must be a valid string' });
    }

    console.log(`🔄 Checking assessment ${assessmentId} for user ${userId} (${userRole})`);
    const assessment = await getAssessmentById(parseInt(assessmentId), userId, userRole);
    if (!assessment) {
      console.warn(`⚠️ Assessment ${assessmentId} not found or access denied for user ${userId}`);
      return res.status(404).json({ success: false, message: 'Assessment not found or access denied' });
    }

    console.log(`🔍 Looking up student by email: ${email}`);
    const student = await findUserByEmail(email);
    if (!student) {
      console.warn(`⚠️ Student not found: ${email}`);
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    if (student.role !== 'student') {
      console.warn(`⚠️ User ${email} is not a student, role: ${student.role}`);
      return res.status(400).json({ success: false, message: `User is not a student (role: ${student.role})` });
    }

    console.log(`🔄 Enrolling student ${student.id} to assessment ${assessmentId}`);
    const enrollment = await enrollStudent(parseInt(assessmentId), email);

    console.log(`🔄 Sending enrollment email to ${email} for assessment ${assessmentId}`);
    await sendAssessmentEnrollmentEmail(email, assessment.title, assessmentId);

    console.log(`✅ Student enrolled successfully for assessment ${assessmentId}`);

    // CLEAR STUDENT'S ASSESSMENT LIST CACHE
    await redis.del(`student:assessments:list:${student.id}`);
    // OR if you use studentId variable:
    await redis.del(`student:assessments:list:${student.id}`);

    res.status(200).json({
      success: true,
      message: 'Student enrolled successfully',
      data: enrollment,
    });
  } catch (error) {
    console.error('❌ Error enrolling student:', error.message, error.stack);
    if (error.message === 'Student already enrolled') {
      return res.status(409).json({ success: false, message: 'Student is already enrolled in this assessment' });
    }
    res.status(500).json({ success: false, message: error.message || 'Failed to enroll student' });
  }
};

//Unenroll Student from Assessment
export const unenrollStudentController = async (req, res) => {
  try {
    const assessmentId = req.params.id;
    const studentId = req.params.studentId;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!assessmentId || isNaN(parseInt(assessmentId))) {
      return res.status(400).json({ success: false, message: 'Invalid assessment ID' });
    }

    if (!studentId || isNaN(parseInt(studentId))) {
      return res.status(400).json({ success: false, message: 'Invalid student ID' });
    }

    console.log(`🔄 Unenrolling student ${studentId} from assessment ${assessmentId} by user ${userId} (${userRole})`);

    const assessment = await getAssessmentById(parseInt(assessmentId), userId, userRole);
    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found or access denied' });
    }

    const result = await unenrollStudent(parseInt(assessmentId), parseInt(studentId));
    await redis.del(`student:assessments:list:${studentId}`);
    res.status(200).json({
      success: true,
      message: 'Student unenrolled successfully',
      data: result,
    });
  } catch (error) {
    console.error('❌ Unenroll student error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unenroll student',
      error: error.message,
    });
  }
};

//Get Enrolled Students for Assessment
export const getEnrolledStudentsController = async (req, res) => {
  try {
    const assessmentId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!assessmentId || isNaN(parseInt(assessmentId))) {
      return res.status(400).json({ success: false, message: 'Invalid assessment ID' });
    }

    console.log(`🔄 Fetching enrolled students for assessment ${assessmentId} by user ${userId} (${userRole})`);

    const assessment = await getAssessmentById(parseInt(assessmentId), userId, userRole);
    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found or access denied' });
    }

    const students = await getEnrolledStudents(parseInt(assessmentId));

    res.status(200).json({
      success: true,
      message: 'Enrolled students retrieved successfully',
      data: students,
    });
  } catch (error) {
    console.error('❌ Get enrolled students error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve enrolled students',
      error: error.message,
    });
  }
};

//Start Assessment for Student
export const startAssessmentForStudent = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { language } = req.body;
    const studentId = req.user.id;

    if (!assessmentId || isNaN(parseInt(assessmentId))) {
      return res.status(400).json({ success: false, message: 'Invalid assessment ID' });
    }

    console.log(`🔄 Starting assessment ${assessmentId} for student ${studentId}`);

    const assessment = await getAssessmentById(parseInt(assessmentId), studentId, 'student');
    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found or access denied' });
    }

    const { rows: enrollRows } = await pool.query(
      `SELECT * FROM enrollments WHERE assessment_id = $1 AND student_id = $2`,
      [assessmentId, studentId]
    );
    if (enrollRows.length === 0) {
      console.warn(`⚠️ Student ${studentId} not enrolled for assessment ${assessmentId}`);
      return res.status(403).json({ success: false, message: 'You are not enrolled for this assessment' });
    }

    const { rows: existingAttempt } = await pool.query(
      `SELECT id FROM assessment_attempts WHERE student_id = $1 AND assessment_id = $2 AND status = 'in_progress'`,
      [studentId, assessmentId]
    );
    if (existingAttempt.length > 0) {
      console.warn(`⚠️ In-progress attempt exists for student ${studentId}, assessment ${assessmentId}`);
      return res.status(400).json({ success: false, message: 'Assessment already in progress' });
    }

    const { rows: attemptRows } = await pool.query(
      `INSERT INTO assessment_attempts (student_id, assessment_id, attempt_number, started_at, language, status)
       VALUES ($1, $2, (SELECT COALESCE(MAX(attempt_number), 0) + 1 FROM assessment_attempts WHERE student_id = $1 AND assessment_id = $2), NOW(), $3, 'in_progress') RETURNING id`,
      [studentId, assessmentId, language]
    );
    const attemptId = attemptRows[0].id;
    console.log(`✅ Created attempt ${attemptId} for assessment ${assessmentId}`);

    const { questions, duration } = await generateAssessmentQuestions(assessmentId, attemptId, language, assessment);

    const { rows: dbQuestions } = await pool.query(
      `SELECT id, question_order, question_type, question_text, options, correct_answer, positive_marks, negative_marks, duration_per_question
       FROM generated_questions WHERE attempt_id = $1 ORDER BY question_order ASC`,
      [attemptId]
    );

    console.log(`✅ Generated ${dbQuestions.length} questions for attempt ${attemptId}`);

    res.status(200).json({
      success: true,
      message: 'Assessment started successfully',
      data: { attemptId, duration, questions: dbQuestions },
    });
  } catch (error) {
    console.error('❌ startAssessmentForStudent error:', error.message, error.stack);
    res.status(500).json({ success: false, message: 'Failed to start assessment' });
  }
};

//Preview Questions for Assessment
export const previewQuestions = async (req, res) => {
  try {
    const assessmentId = parseInt(req.params.id);
    const instructorId = req.user.id;

    console.log(`[PREVIEW] Request from instructor ${instructorId} for assessment ${assessmentId}`);

    const assessment = await getAssessmentById(assessmentId, instructorId, req.user.role);
    if (!assessment) {
      console.log(`[PREVIEW] Assessment ${assessmentId} not found or access denied`);
      return res.status(404).json({ success: false, message: "Assessment not found" });
    }

    console.log(`[PREVIEW] Generating sample questions for assessment ${assessmentId}`);

    const { questions } = await generateAssessmentQuestions(assessmentId, null, 'en', assessment);

    console.log(`[PREVIEW] Successfully generated ${questions.length} sample questions`);

    res.json({ success: true, questions });
  } catch (error) {
    console.error("[PREVIEW] ERROR:", error.message);
    res.status(500).json({ success: false, message: "Failed to generate preview questions" });
  }
};

//Generate Physical Paper for Assessment
export const generatePhysicalPaper = async (req, res) => {
  try {
    const assessmentId = parseInt(req.params.id);
    const instructorId = req.user.id;
    const {
      language = "en",
      instituteName = "",
      teacherName = "",
      subjectName = "",
      paperDate = "",
      paperTime = "",
      notes = "",
    } = req.body;

    console.log(`[PRINT] Generating paper for assessment ${assessmentId} in language: ${language}`);

    const assessment = await getAssessmentById(assessmentId, instructorId, req.user.role);
    if (!assessment) {
      return res.status(404).json({ success: false, message: "Assessment not found" });
    }

    // Generate questions in selected language
    const { questions } = await generateAssessmentQuestions(assessmentId, null, language, assessment);

    if (!questions || questions.length === 0) {
      return res.status(400).json({ success: false, message: "No questions generated" });
    }

    // Full language name map for AI
    const langMap = {
      en: "English",
      ar: "Arabic",
      ur: "Urdu",
      hi: "Hindi",
      bn: "Bengali",
      es: "Spanish",
      fr: "French",
    };
    const langName = langMap[language] || "English";

    // Labels in target language
    const labels = {
      en: { institute: "Institute Name", teacher: "Teacher Name", subject: "Subject Name", date: "Paper Date", time: "Paper Time", notes: "Notes" },
      ar: { institute: "اسم المعهد", teacher: "اسم المعلم", subject: "اسم المادة", date: "تاريخ الامتحان", time: "وقت الامتحان", notes: "ملاحظات" },
      ur: { institute: "ادارے کا نام", teacher: "استاد کا نام", subject: "مضمون کا نام", date: "امتحان کی تاریخ", time: "امتحان کا وقت", notes: "نوٹس" },
      hi: { institute: "संस्थान का नाम", teacher: "शिक्षक का नाम", subject: "विषय का नाम", date: "परीक्षा तिथि", time: "परीक्षा समय", notes: "नोट्स" },
      bn: { institute: "প্রতিষ্ঠানের নাম", teacher: "শিক্ষকের নাম", subject: "বিষয়ের নাম", date: "পরীক্ষার তারিখ", time: "পরীক্ষার সময়", notes: "নোট" },
      es: { institute: "Nombre del instituto", teacher: "Nombre del profesor", subject: "Nombre de la asignatura", date: "Fecha del examen", time: "Hora del examen", notes: "Notas" },
      fr: { institute: "Nom de l'institut", teacher: "Nom de l'enseignant", subject: "Nom de la matière", date: "Date de l'examen", time: "Heure de l'examen", notes: "Notes" },
    }[language] || labels.en;

    // Build header text with target language labels
    const headerText = `
${labels.institute}: ${instituteName || "Not provided"}
${labels.teacher}: ${teacherName || "Not provided"}
${labels.subject}: ${subjectName || "Not provided"}
${labels.date}: ${paperDate || "Not provided"}
${labels.time}: ${paperTime || "Not provided"}
${labels.notes}:
${notes || "No additional notes"}
`.trim();

    let translatedHeaders = {
      instituteName,
      teacherName,
      subjectName,
      paperDate,
      paperTime,
      notes,
    };

    // Only translate if not English
    if (language !== "en") {
      const translationPrompt = `Translate the following exam paper header into natural ${langName}. 
Keep the exact labels as they are, but translate only the values after the colon naturally.

Text:
${headerText}

Output only the translated text in the same format. No extra text.`;

      try {
        const translatedAI = await generateContent(translationPrompt, { maxOutputTokens: 1000 });
        const lines = translatedAI.split("\n").map(l => l.trim()).filter(Boolean);

        translatedHeaders = {
          instituteName: extractValue(lines, labels.institute) || instituteName,
          teacherName: extractValue(lines, labels.teacher) || teacherName,
          subjectName: extractValue(lines, labels.subject) || subjectName,
          paperDate: extractValue(lines, labels.date) || paperDate,
          paperTime: extractValue(lines, labels.time) || paperTime,
          notes: extractNotes(lines, labels.notes) || notes,
        };
      } catch (err) {
        console.warn("Header translation failed, using original text", err);
        // Keep original if AI fails
      }
    }

    const isRTL = ["ar", "ur", "he"].includes(language);

    res.json({
      success: true,
      data: {
        questions,
        headers: translatedHeaders,
        isRTL,
      },
    });
  } catch (error) {
    console.error("[PRINT] ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to prepare paper data" });
  }
};

// Robust helper functions
const extractValue = (lines, label) => {
  const line = lines.find(l => l.startsWith(label + ":"));
  if (line) {
    return line.split(":").slice(1).join(":").trim();
  }
  return null;
};

const extractNotes = (lines, label) => {
  const index = lines.findIndex(l => l.startsWith(label + ":"));
  if (index !== -1 && index + 1 < lines.length) {
    return lines.slice(index + 1).join("\n").trim();
  }
  return null;
};

