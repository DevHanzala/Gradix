import { getAssessmentsByInstructor, getAssessmentById, getEnrolledStudents, generateAssessmentQuestions } from "../models/assessmentModel.js";
import { generateContent } from "./ai/generateContent.js";
import { findUserByEmail, getUserById } from "../models/userModel.js";
import { sendAssessmentEnrollmentEmail } from "../helper/emailService.js";
import { prepareUploadedFiles, insertPreparedResource } from "../helper/resourceIngest.js";
import { withTransaction } from "../DB/db.js";
import * as assessmentRepo from "../repositories/assessmentRepository.js";
import { findAssessmentLifecycleQuery } from "../repositories/objectiveRepository.js";
import { requireAssessmentAccess } from "./assessmentAccess.js";
import { requestObjectiveExtraction, recomputeBlueprint } from "./objectives.service.js";
import { assertResourcesUsable } from "./resource.service.js";
import { AppError } from "../utils/AppError.js";
import {
  parseJsonField,
  normalizeQuestionBlocks,
  normalizeLinks,
  normalizeResourceIds,
  normalizeAssessmentInput,
} from "../validator/assessmentInput.js";

/** multipart sends booleans as strings; undefined means "not sent". */
const parseFlag = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  return ["true", "1", "on", "yes"].includes(String(value).toLowerCase());
};

// ==================== CREATE ====================

/**
 * Create an assessment from title + (prompt | links | resources | files).
 * Uploaded files are extracted and embedded BEFORE anything is written, then
 * the assessment, its blocks, links and new resources are inserted in one
 * transaction, so a failure never leaves half-written data.
 */
export const createAssessmentService = async (body, user, files = []) => {
  const links = normalizeLinks(parseJsonField(body.external_links ?? body.externalLinks, []));
  const resourceIds = normalizeResourceIds(parseJsonField(body.selected_resources, []));
  const blocks = normalizeQuestionBlocks(parseJsonField(body.question_blocks, []));
  const { title, prompt } = normalizeAssessmentInput({
    title: body.title,
    prompt: body.prompt,
    links,
    resourceIds,
    fileCount: files.length,
  });

  await assertResourcesUsable(resourceIds, user);
  const prepared = await prepareUploadedFiles(files);

  const created = await withTransaction(async (client) => {
    const assessment = await assessmentRepo.createAssessmentQuery(
      {
        title,
        prompt,
        external_links: links,
        instructor_id: user.id,
        is_executed: false,
        adaptive: parseFlag(body.adaptive) ?? false,
        show_live_score: parseFlag(body.show_live_score) ?? false,
      },
      client
    );

    for (const block of blocks) {
      await assessmentRepo.createQuestionBlockQuery({ assessmentId: assessment.id, ...block, instructorId: user.id }, client);
    }
    for (const resourceId of resourceIds) {
      await assessmentRepo.linkResourceToAssessmentQuery(assessment.id, resourceId, client);
    }
    for (const file of prepared) {
      const resource = await insertPreparedResource(client, file, { userId: user.id });
      await assessmentRepo.linkResourceToAssessmentQuery(assessment.id, resource.id, client);
    }

    return assessment;
  });

  // After commit: objectives are extracted in the background.
  await requestObjectiveExtraction(created.id);
  const lifecycle = await findAssessmentLifecycleQuery(created.id);
  return { ...created, status: lifecycle.status, objectives_state: lifecycle.objectives_state };
};

// ==================== READ ====================

export const getInstructorAssessmentsService = async (instructorId) => {
  const assessments = await getAssessmentsByInstructor(instructorId);
  return { data: assessments };
};

export const getAssessmentService = async (assessmentId, user) => {
  if (user.role !== "student") {
    const owned = await requireAssessmentAccess(assessmentId, user);
    const full = await assessmentRepo.findAssessmentByIdForInstructorQuery(owned.id, owned.instructor_id);
    return {
      data: {
        ...full,
        external_links: full.external_links || [],
        question_blocks: full.question_blocks || [],
        resources: full.resources || [],
      },
    };
  }

  const id = Number.parseInt(assessmentId, 10);
  if (!Number.isInteger(id)) throw new AppError("INVALID_ASSESSMENT_ID", 400, "Invalid assessment ID");
  const assessment = await getAssessmentById(id, user.id, user.role);
  if (!assessment) throw new AppError("ASSESSMENT_NOT_FOUND", 404, "Assessment not found");
  return { data: assessment };
};

// ==================== UPDATE ====================

/**
 * Update an assessment that no student has started yet (owner or super_admin).
 * Question blocks are replaced only when sent. Resource links are replaced by
 * `selected_resources` plus any newly uploaded files. All writes are atomic.
 */
export const updateAssessmentService = async (assessmentId, body, user, files = []) => {
  const existing = await requireAssessmentAccess(assessmentId, user, { lockAfterExecution: true });

  const links = normalizeLinks(parseJsonField(body.external_links ?? body.externalLinks, []));
  const resourceIds = normalizeResourceIds(parseJsonField(body.selected_resources, []));
  const rawBlocks = parseJsonField(body.question_blocks, undefined);
  const blocks = rawBlocks === undefined ? null : normalizeQuestionBlocks(rawBlocks);
  const { title, prompt } = normalizeAssessmentInput({
    title: body.title,
    prompt: body.prompt,
    links,
    resourceIds,
    fileCount: files.length,
  });

  await assertResourcesUsable(resourceIds, user);
  const prepared = await prepareUploadedFiles(files);

  const lifecycle = await findAssessmentLifecycleQuery(existing.id);
  if (!["draft", "objectives_ready"].includes(lifecycle.status)) {
    throw new AppError(
      "ASSESSMENT_LOCKED",
      409,
      "This assessment is being published or has been published and can no longer be changed"
    );
  }
  const adaptiveFlag = parseFlag(body.adaptive);
  const previousResourceIds = await assessmentRepo.findAssessmentResourceIdsQuery(existing.id);
  const sourcesChanged =
    title !== existing.title ||
    (prompt || "") !== (existing.prompt || "") ||
    JSON.stringify(links) !== JSON.stringify(existing.external_links || []) ||
    prepared.length > 0 ||
    [...resourceIds].sort((a, b) => a - b).join(",") !== previousResourceIds.join(",");

  const result = await withTransaction(async (client) => {
    const updated = await assessmentRepo.updateAssessmentQuery(
      existing.id,
      { title, prompt, external_links: links, adaptive: adaptiveFlag, show_live_score: parseFlag(body.show_live_score) },
      client
    );

    if (blocks) {
      await assessmentRepo.deleteQuestionBlocksByAssessmentQuery(existing.id, client);
      for (const block of blocks) {
        await assessmentRepo.createQuestionBlockQuery({ assessmentId: existing.id, ...block, instructorId: user.id }, client);
      }
    }

    await assessmentRepo.deleteAssessmentResourceLinksQuery(existing.id, client);
    for (const resourceId of resourceIds) {
      await assessmentRepo.linkResourceToAssessmentQuery(existing.id, resourceId, client);
    }
    for (const file of prepared) {
      const resource = await insertPreparedResource(client, file, { userId: user.id });
      await assessmentRepo.linkResourceToAssessmentQuery(existing.id, resource.id, client);
    }

    // Same material, new blocks or adaptivity: keep the objectives, re-plan the blueprint.
    if (!sourcesChanged && (blocks || adaptiveFlag !== undefined)) await recomputeBlueprint(existing.id, client);
    return updated;
  });

  // New material means new objectives (instructor edits to the old ones no longer apply).
  if (sourcesChanged) await requestObjectiveExtraction(existing.id);
  return result;
};

// ==================== DELETE ====================

export const deleteAssessmentService = async (assessmentId, user) => {
  const assessment = await requireAssessmentAccess(assessmentId, user, { lockAfterExecution: true });
  await assessmentRepo.deleteAssessmentQuery(assessment.id);
  return { success: true };
};

// ==================== ENROLLMENT ====================

export const enrollStudentService = async (assessmentId, email, user) => {
  const assessment = await requireAssessmentAccess(assessmentId, user);

  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalizedEmail) throw new AppError("EMAIL_REQUIRED", 400, "Student email is required.");

  const student = await findUserByEmail(normalizedEmail);
  if (!student) throw new AppError("STUDENT_NOT_FOUND", 404, "No account exists with that email.");
  if (student.role !== "student") throw new AppError("NOT_A_STUDENT", 400, "That account is not a student account.");

  let enrollment;
  try {
    enrollment = await assessmentRepo.createEnrollmentQuery(assessment.id, student.id);
  } catch (error) {
    if (error.code === "23505") throw new AppError("ALREADY_ENROLLED", 409, "This student is already enrolled.");
    throw error;
  }

  // After the insert has committed; failures are logged, never thrown.
  const instructor = await getUserById(user.id);
  sendAssessmentEnrollmentEmail(student, assessment.title, instructor?.name);

  return { enrollment, student: { id: student.id, name: student.name, email: student.email } };
};

export const unenrollStudentService = async (assessmentId, studentId, user) => {
  const assessment = await requireAssessmentAccess(assessmentId, user);
  const sid = Number.parseInt(studentId, 10);
  if (!Number.isInteger(sid)) throw new AppError("INVALID_STUDENT_ID", 400, "Invalid student ID.");

  const removed = await assessmentRepo.deleteEnrollmentQuery(assessment.id, sid);
  if (!removed) throw new AppError("ENROLLMENT_NOT_FOUND", 404, "This student is not enrolled.");
  return removed;
};

export const getEnrolledStudentsService = async (assessmentId, user) => {
  const assessment = await requireAssessmentAccess(assessmentId, user);
  return getEnrolledStudents(assessment.id);
};

// ==================== AI PREVIEW / PRINT ====================

export const previewQuestionsService = async (assessmentId, user) => {
  const assessment = await requireAssessmentAccess(assessmentId, user);
  const { questions } = await generateAssessmentQuestions(assessment.id, "en", assessment);
  return questions;
};

const PAPER_LANGUAGES = { en: "English", ar: "Arabic", ur: "Urdu", fa: "Persian" };
const PAPER_LABELS = {
  en: { institute: "Institute Name", teacher: "Teacher Name", subject: "Subject Name", date: "Paper Date", time: "Paper Time", notes: "Notes" },
  ar: { institute: "اسم المعهد", teacher: "اسم المعلم", subject: "اسم المادة", date: "تاريخ الامتحان", time: "وقت الامتحان", notes: "ملاحظات" },
  ur: { institute: "ادارے کا نام", teacher: "استاد کا نام", subject: "مضمون کا نام", date: "امتحان کی تاریخ", time: "امتحان کا وقت", notes: "نوٹس" },
  fa: { institute: "نام موسسه", teacher: "نام معلم", subject: "نام درس", date: "تاریخ امتحان", time: "زمان امتحان", notes: "یادداشت ها" },
};

const extractValue = (lines, label) => {
  const line = lines.find((l) => l.includes(label));
  if (!line) return null;
  const parts = line.split(":");
  return parts.length < 2 ? null : parts.slice(1).join(":").trim();
};

const extractNotes = (lines, notesLabel) => {
  const index = lines.findIndex((l) => l.includes(notesLabel));
  return index === -1 ? null : lines.slice(index + 1).join("\n").trim();
};

/**
 * Generate a fresh question set in `language` for a printed paper. Nothing is
 * written to the database (no fake attempts).
 */
export const generatePhysicalPaperService = async (assessmentId, user, paperData) => {
  const {
    language = "en",
    instituteName = "",
    teacherName = "",
    subjectName = "",
    paperDate = "",
    paperTime = "",
    notes = "",
  } = paperData;

  if (!PAPER_LANGUAGES[language]) throw new AppError("UNSUPPORTED_LANGUAGE", 400, "Unsupported language.");

  const assessment = await requireAssessmentAccess(assessmentId, user);
  const { questions } = await generateAssessmentQuestions(assessment.id, language, assessment);
  if (!questions || questions.length === 0) {
    throw new AppError("GENERATION_FAILED", 503, "Could not generate questions for the paper. Please try again.");
  }

  const labels = PAPER_LABELS[language];
  let headers = { instituteName, teacherName, subjectName, paperDate, paperTime, notes };

  if (language !== "en") {
    const langName = PAPER_LANGUAGES[language];
    const headerText = [
      `${labels.institute}: ${instituteName || "Not provided"}`,
      `${labels.teacher}: ${teacherName || "Not provided"}`,
      `${labels.subject}: ${subjectName || "Not provided"}`,
      `${labels.date}: ${paperDate || "Not provided"}`,
      `${labels.time}: ${paperTime || "Not provided"}`,
      `${labels.notes}:`,
      notes || "No additional notes",
    ].join("\n");

    const translationPrompt = `You are a professional translator. Translate the following exam paper header into natural, fluent ${langName}.
Rules: keep the labels before each colon exactly as given; translate only the values after the colons;
keep the same lines and format; output only the translated text.

${headerText}`;

    try {
      const translated = await generateContent(translationPrompt, {
        purpose: "paper_header_translation",
        assessmentId: assessment.id,
        userId: user.id,
        maxOutputTokens: 1000,
        temperature: 0.3,
      });
      const lines = translated.split("\n").map((l) => l.trim()).filter(Boolean);
      headers = {
        instituteName: extractValue(lines, labels.institute) || instituteName,
        teacherName: extractValue(lines, labels.teacher) || teacherName,
        subjectName: extractValue(lines, labels.subject) || subjectName,
        paperDate: extractValue(lines, labels.date) || paperDate,
        paperTime: extractValue(lines, labels.time) || paperTime,
        notes: extractNotes(lines, labels.notes) || notes,
      };
    } catch (error) {
      console.error(`[PAPER] Header translation failed, using original text: ${error.message}`);
    }
  }

  return { questions, headers, isRTL: ["ar", "ur", "fa"].includes(language) };
};
