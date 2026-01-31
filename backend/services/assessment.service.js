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
import { generateContent } from './ai/generateContent.js';
import { findUserByEmail } from '../models/userModel.js';
import { createResource, linkResourceToAssessment } from '../models/resourceModel.js';
import { uploadResource } from '../controllers/resourceController.js';
import { sendAssessmentEnrollmentEmail } from '../helper/emailService.js';
import { extractTextFromFile, chunkText } from '../helper/textProcessor.js';
import { generateEmbedding } from '../helper/embeddingGenerator.js';
import { redis } from '../DB/redis.js';
import pool from '../DB/db.js';

// ==================== SERVICE FUNCTIONS ====================

// 1. CREATE ASSESSMENT BASIC SERVICE
export const createAssessmentBasicService = async (payload, userId, files) => {
  const normalizedPayload = payload;
  console.log('Normalized Payload:', normalizedPayload);
  const assessment = await createAssessmentRecord(normalizedPayload, userId);

  await processQuestionBlocks(
    assessment.id,
    normalizedPayload.question_blocks,
    userId
  );

  // ✅ LINK SELECTED RESOURCES (THIS WAS MISSING)
  if (Array.isArray(normalizedPayload.selected_resources)) {
    for (const resourceId of normalizedPayload.selected_resources) {
      await linkResourceToAssessment(
        assessment.id,
        resourceId
      );

    }
  }

  // still allow file uploads
  await processResourcesService(files, assessment.id, userId);

  return assessment;
};

// 2. CREATE NEW ASSESSMENT SERVICE
export const createNewAssessmentService = async (data, userId, files) => {
  const {
    title,
    prompt,
    externalLinks,
    question_blocks,
    selected_resources = [],
  } = data;

  const new_files = files?.new_files || [];

  // Validate title
  if (!title || !title.trim()) {
    throw new Error('Assessment Title is required');
  }

  // Check if user provided any source
  const hasFiles = new_files.length > 0;
  const hasLinks = Array.isArray(externalLinks) && externalLinks.some(l => l && l.trim());
  const hasSelectedResources = selected_resources.length > 0;
  const hasAnySource = hasFiles || hasLinks || hasSelectedResources;

  // Validate prompt requirement
  if (!hasAnySource && (!prompt || !prompt.trim())) {
    throw new Error('Prompt is required when no resources or links are provided');
  }

  // Validate question blocks
  if (question_blocks && Array.isArray(question_blocks) && question_blocks.length > 0) {
    for (const block of question_blocks) {
      if (!block.question_count || block.question_count < 1) {
        throw new Error('Question count must be at least 1');
      }
      if (!block.duration_per_question || block.duration_per_question < 30) {
        throw new Error('Duration per question must be at least 30 seconds');
      }
      if (block.question_type === 'multiple_choice' && (!block.num_options || block.num_options < 2)) {
        throw new Error('Multiple choice needs at least 2 options');
      }
    }
  }

  // Prepare assessment data
  const assessmentData = {
    title: title.trim(),
    prompt: hasAnySource ? (prompt?.trim() || null) : prompt.trim(),
    external_links: hasLinks ? externalLinks.filter(link => link && link.trim()) : null,
    instructor_id: userId,
    is_executed: false,
  };

  console.log('Creating assessment:', assessmentData);

  const newAssessment = await createAssessment(assessmentData);

  // Store question blocks
  if (question_blocks?.length > 0) {
    await storeQuestionBlocks(newAssessment.id, question_blocks, userId);
  }

  // Handle file uploads
  let newResourceIds = [];
  if (hasFiles) {
    const uploaded = await uploadResource({ files: new_files });
    newResourceIds = uploaded.map(r => r.id);
  }

  // Link all resources
  const allResourceIds = [...selected_resources.map(id => parseInt(id)), ...newResourceIds];
  for (const id of allResourceIds) {
    if (!isNaN(id)) await linkResourceToAssessment(newAssessment.id, id);
  }

  // Clear cache
  await redis.del(`instructor:assessments:${userId}`);

  return newAssessment;
};

// 3. GET INSTRUCTOR ASSESSMENTS SERVICE
export const getInstructorAssessmentsService = async (instructorId) => {
  const cacheKey = `instructor:assessments:${instructorId}`;

  const cached = await redis.get(cacheKey);
  if (cached) {
    try {
      return {
        data: JSON.parse(cached),
        fromCache: true,
      };
    } catch (err) {
      console.warn('⚠️ Corrupted cache, clearing:', cacheKey);
      await redis.del(cacheKey);
    }
  }

  const assessments = await getAssessmentsByInstructor(instructorId);

  await redis.set(
    cacheKey,
    JSON.stringify(assessments),
    { ex: 600 }
  );

  return { data: assessments, fromCache: false };
};


// 4. GET SINGLE ASSESSMENT SERVICE
export const getAssessmentService = async (assessmentId, userId, userRole) => {
  if (isNaN(assessmentId)) {
    throw new Error('Invalid assessment ID');
  }
const safeJsonParse = (value) => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
};


  const cacheKey = `assessment:single:${assessmentId}:${userId}`;

  const cached = await redis.get(cacheKey);
  if (cached) {
    return {
      data: safeJsonParse(cached),
      fromCache: true,
    };
  }

  const assessment = await getAssessmentById(assessmentId, userId, userRole);
  if (!assessment) {
    throw new Error('Assessment not found or access denied');
  }

  await redis.set(
    cacheKey,
    JSON.stringify(assessment),
    { ex: 600 }
  );

  return { data: assessment, fromCache: false };
};

// 5. UPDATE ASSESSMENT SERVICE
export const updateAssessmentService = async (assessmentId, updateData, userId, files) => {
  const { title, prompt, externalLinks, question_blocks, selected_resources } = updateData;
  const new_files = files || [];

  if (!title?.trim()) {
    throw new Error('Assessment Title is required');
  }

  const hasPrompt = prompt?.trim();
  const hasLinks = Array.isArray(externalLinks) && externalLinks.some(l => l?.trim());
  const hasResources = selected_resources.length > 0 || new_files.length > 0;

  if (!hasPrompt && !hasLinks && !hasResources) {
    throw new Error('You must provide either a Prompt, Resources, or External Links');
  }

  const updatePayload = {
    title: title.trim(),
    prompt: hasPrompt ? prompt.trim() : null,
    external_links: hasLinks ? externalLinks.filter(l => l?.trim()) : null,
  };

  const updatedAssessment = await updateAssessment(parseInt(assessmentId), updatePayload);

  // Update question blocks
  if (question_blocks.length > 0) {
    await storeQuestionBlocks(parseInt(assessmentId), question_blocks, userId);
  }

  // Clear old resource links
  await pool.query(`DELETE FROM assessment_resources WHERE assessment_id = $1`, [assessmentId]);

  // Link selected existing resources
  for (const resourceId of selected_resources) {
    if (!isNaN(parseInt(resourceId))) {
      await linkResourceToAssessment(assessmentId, parseInt(resourceId));
    }
  }

  // Process new uploaded files
  for (const file of new_files) {
    const text = await extractTextFromFile(file.buffer, file.mimetype);
    const chunks = chunkText(text, 500);

    const resource = await createResource({
      name: file.originalname,
      file_type: file.mimetype,
      file_size: file.size,
      content_type: 'file',
      visibility: 'private',
      uploaded_by: userId,
    });

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await generateEmbedding(chunks[i]);
      await storeResourceChunk(resource.id, chunks[i], embedding, { chunk_index: i });
    }

    await linkResourceToAssessment(assessmentId, resource.id);
  }

  // Clear cache
  await clearAssessmentCache(assessmentId, userId);

  return updatedAssessment;
};

// 6. DELETE ASSESSMENT SERVICE
export const deleteAssessmentService = async (assessmentId, userId, userRole) => {
  if (!assessmentId || isNaN(parseInt(assessmentId))) {
    throw new Error('Invalid assessment ID');
  }

  console.log(`🔄 Deleting assessment ${assessmentId} for user ${userId} (${userRole})`);

  const assessment = await getAssessmentById(parseInt(assessmentId), userId, userRole);
  if (!assessment) {
    throw new Error('Assessment not found or access denied');
  }

  await deleteAssessment(parseInt(assessmentId));

  console.log(`✅ Assessment deleted: ID=${assessmentId}`);

  // Clear cache
  await clearAssessmentCache(assessmentId, userId);

  return { success: true };
};

// 7. ENROLL STUDENT SERVICE
export const enrollStudentService = async (assessmentId, email, userId, userRole) => {
  console.log(`🔍 Validating enrollment for assessment ${assessmentId}, email: ${email}, user: ${userId} (${userRole})`);

  if (!assessmentId || isNaN(parseInt(assessmentId))) {
    throw new Error('Invalid assessment ID');
  }

  if (!email || typeof email !== 'string' || !email.trim()) {
    throw new Error('Student email is required and must be a valid string');
  }

  console.log(`🔄 Checking assessment ${assessmentId} for user ${userId} (${userRole})`);
  const assessment = await getAssessmentById(parseInt(assessmentId), userId, userRole);
  if (!assessment) {
    throw new Error('Assessment not found or access denied');
  }

  console.log(`🔍 Looking up student by email: ${email}`);
  const student = await findUserByEmail(email);
  if (!student) {
    throw new Error('Student not found');
  }

  if (student.role !== 'student') {
    throw new Error(`User is not a student (role: ${student.role})`);
  }

  console.log(`🔄 Enrolling student ${student.id} to assessment ${assessmentId}`);
  const enrollment = await enrollStudent(parseInt(assessmentId), email);

  console.log(`🔄 Sending enrollment email to ${email} for assessment ${assessmentId}`);
  await sendAssessmentEnrollmentEmail(email, assessment.title, assessmentId);

  console.log(`✅ Student enrolled successfully for assessment ${assessmentId}`);

  // Clear student's assessment list cache
  await redis.del(`student:assessments:list:${student.id}`);

  return { enrollment, student };
};

// 8. UNENROLL STUDENT SERVICE
export const unenrollStudentService = async (assessmentId, studentId, userId, userRole) => {
  if (!assessmentId || isNaN(parseInt(assessmentId))) {
    throw new Error('Invalid assessment ID');
  }

  if (!studentId || isNaN(parseInt(studentId))) {
    throw new Error('Invalid student ID');
  }

  console.log(`🔄 Unenrolling student ${studentId} from assessment ${assessmentId} by user ${userId} (${userRole})`);

  const assessment = await getAssessmentById(parseInt(assessmentId), userId, userRole);
  if (!assessment) {
    throw new Error('Assessment not found or access denied');
  }

  const result = await unenrollStudent(parseInt(assessmentId), parseInt(studentId));

  // Clear cache
  await redis.del(`student:assessments:list:${studentId}`);

  return result;
};

// 9. GET ENROLLED STUDENTS SERVICE
export const getEnrolledStudentsService = async (assessmentId, userId, userRole) => {
  if (!assessmentId || isNaN(parseInt(assessmentId))) {
    throw new Error('Invalid assessment ID');
  }

  console.log(`🔄 Fetching enrolled students for assessment ${assessmentId} by user ${userId} (${userRole})`);

  const assessment = await getAssessmentById(parseInt(assessmentId), userId, userRole);
  if (!assessment) {
    throw new Error('Assessment not found or access denied');
  }

  const students = await getEnrolledStudents(parseInt(assessmentId));

  return students;
};


// 10. PREVIEW QUESTIONS SERVICE
export const previewQuestionsService = async (assessmentId, instructorId, userRole) => {
  console.log(`[PREVIEW] Request from instructor ${instructorId} for assessment ${assessmentId}`);

  const assessment = await getAssessmentById(assessmentId, instructorId, userRole);
  if (!assessment) {
    console.log(`[PREVIEW] Assessment ${assessmentId} not found or access denied`);
    throw new Error('Assessment not found');
  }

  console.log(`[PREVIEW] Generating sample questions for assessment ${assessmentId}`);

  const { questions } = await generateAssessmentQuestions(assessmentId, null, 'en', assessment);

  console.log(`[PREVIEW] Successfully generated ${questions.length} sample questions`);

  return questions;
};

// 11. GENERATE PHYSICAL PAPER SERVICE
export const generatePhysicalPaperService = async (assessmentId, instructorId, userRole, paperData) => {
  const {
    language = 'en',
    instituteName = '',
    teacherName = '',
    subjectName = '',
    paperDate = '',
    paperTime = '',
    notes = '',
  } = paperData;

  console.log(`[PRINT] Generating paper for assessment ${assessmentId} in language: ${language}`);

  const assessment = await getAssessmentById(assessmentId, instructorId, userRole);
  if (!assessment) {
    throw new Error('Assessment not found');
  }

  // Generate questions in selected language
  const { questions } = await generateAssessmentQuestions(assessmentId, null, language, assessment);

  if (!questions || questions.length === 0) {
    throw new Error('No questions generated');
  }

  // Full language name map for AI
  const langMap = {
    en: 'English',
    ar: 'Arabic',
    ur: 'Urdu',
    hi: 'Hindi',
    bn: 'Bengali',
    es: 'Spanish',
    fr: 'French',
  };
  const langName = langMap[language] || 'English';

  // Labels in target language
  const labels = {
    en: { institute: 'Institute Name', teacher: 'Teacher Name', subject: 'Subject Name', date: 'Paper Date', time: 'Paper Time', notes: 'Notes' },
    ar: { institute: 'اسم المعهد', teacher: 'اسم المعلم', subject: 'اسم المادة', date: 'تاريخ الامتحان', time: 'وقت الامتحان', notes: 'ملاحظات' },
    ur: { institute: 'ادارے کا نام', teacher: 'استاد کا نام', subject: 'مضمون کا نام', date: 'امتحان کی تاریخ', time: 'امتحان کا وقت', notes: 'نوٹس' },
    hi: { institute: 'संस्थान का नाम', teacher: 'शिक्षक का नाम', subject: 'विषय का नाम', date: 'परीक्षा तिथि', time: 'परीक्षा समय', notes: 'नोट्स' },
    bn: { institute: 'প্রতিষ্ঠানের নাম', teacher: 'শিক্ষকের নাম', subject: 'বিষয়ের নাম', date: 'পরীক্ষার তারিখ', time: 'পরীক্ষার সময়', notes: 'নোট' },
    es: { institute: 'Nombre del instituto', teacher: 'Nombre del profesor', subject: 'Nombre de la asignatura', date: 'Fecha del examen', time: 'Hora del examen', notes: 'Notas' },
    fr: { institute: "Nom de l'institut", teacher: "Nom de l'enseignant", subject: 'Nom de la matière', date: "Date de l'examen", time: "Heure de l'examen", notes: 'Notes' },
  }[language] || labels.en;

  // Build header text with target language labels
  const headerText = `
${labels.institute}: ${instituteName || 'Not provided'}
${labels.teacher}: ${teacherName || 'Not provided'}
${labels.subject}: ${subjectName || 'Not provided'}
${labels.date}: ${paperDate || 'Not provided'}
${labels.time}: ${paperTime || 'Not provided'}
${labels.notes}:
${notes || 'No additional notes'}
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
  if (language !== 'en') {
    const translationPrompt = `Translate the following exam paper header into natural ${langName}. 
Keep the exact labels as they are, but translate only the values after the colon naturally.

Text:
${headerText}

Output only the translated text in the same format. No extra text.`;

    try {
      const translatedAI = await generateContent(translationPrompt, { maxOutputTokens: 1000 });
      const lines = translatedAI.split('\n').map(l => l.trim()).filter(Boolean);

      translatedHeaders = {
        instituteName: extractValue(lines, labels.institute) || instituteName,
        teacherName: extractValue(lines, labels.teacher) || teacherName,
        subjectName: extractValue(lines, labels.subject) || subjectName,
        paperDate: extractValue(lines, labels.date) || paperDate,
        paperTime: extractValue(lines, labels.time) || paperTime,
        notes: extractNotes(lines, labels.notes) || notes,
      };
    } catch (err) {
      console.warn('Header translation failed, using original text', err);
    }
  }

  const isRTL = ['ar', 'ur', 'he'].includes(language);

  return {
    questions,
    headers: translatedHeaders,
    isRTL,
  };
};

// ==================== HELPER FUNCTIONS ====================

const normalizePayload = (body) => {
  return body;
};

const createAssessmentRecord = async (payload, userId) => {
  const assessmentData = {
    title: payload.title,
    prompt: payload.prompt,
    external_links: payload.external_links,
    instructor_id: userId,
    is_executed: false,
  };
  return await createAssessment(assessmentData);
};

const processQuestionBlocks = async (assessmentId, questionBlocks, userId) => {
  if (questionBlocks && questionBlocks.length > 0) {
    await storeQuestionBlocks(assessmentId, questionBlocks, userId);
  }
};

const processResourcesService = async (files, assessmentId, userId) => {
  if (!files || files.length === 0) return;

  for (const file of files) {
    const text = await extractTextFromFile(file.buffer, file.mimetype);
    const chunks = chunkText(text, 500);

    const resource = await createResource({
      name: file.originalname,
      file_type: file.mimetype,
      file_size: file.size,
      content_type: 'file',
      visibility: 'private',
      uploaded_by: userId,
    });

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await generateEmbedding(chunks[i]);
      await storeResourceChunk(resource.id, chunks[i], embedding, { chunk_index: i });
    }

    await linkResourceToAssessment(assessmentId, resource.id);
  }
};

const clearAssessmentCache = async (assessmentId, instructorId) => {
  // Clear instructor list
  await redis.del(`instructor:assessments:${instructorId}`);

  // Clear all single-assessment caches
  const keys = await redis.keys(`assessment:single:${assessmentId}:*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  console.log(`🧹 Cache cleared for assessment ${assessmentId}`);
};

const extractValue = (lines, label) => {
  const line = lines.find(l => l.startsWith(label + ':'));
  if (line) {
    return line.split(':').slice(1).join(':').trim();
  }
  return null;
};

const extractNotes = (lines, label) => {
  const index = lines.findIndex(l => l.startsWith(label + ':'));
  if (index !== -1 && index + 1 < lines.length) {
    return lines.slice(index + 1).join('\n').trim();
  }
  return null;
};