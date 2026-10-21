import { getAssessmentsByInstructor, getAssessmentById, getEnrolledStudents, generateAssessmentQuestions } from "../models/assessmentModel.js";
import { findUserByEmail, getUserById } from "../models/userModel.js";
import { sendAssessmentEnrollmentEmail } from "../helper/emailService.js";
import { prepareUploadedFiles, insertPreparedResource, prepareLink } from "../helper/resourceIngest.js";
import db, { withTransaction } from "../DB/db.js";
import { notify } from "./notification.service.js";
import { groupStudentsForEnrollment } from "./group.service.js";
import { buildPaperSets } from "./paper/paperSets.js";
import { renderPaperDocx, renderPaperPdf } from "./paper/paperRender.js";
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

/**
 * Read every link (web page or YouTube transcript). A link that cannot be
 * read does not block saving; it is reported back to the instructor.
 */
const prepareLinks = async (links) => {
  const prepared = [];
  const skipped = [];
  for (const url of links) {
    try {
      prepared.push(await prepareLink(url));
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      skipped.push({ url, reason: error.message });
    }
  }
  return { prepared, skipped };
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
  const linkSources = await prepareLinks(links);

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
        negative_marking: parseFlag(body.negative_marking) ?? true,
      },
      client
    );

    for (const block of blocks) {
      await assessmentRepo.createQuestionBlockQuery({ assessmentId: assessment.id, ...block, instructorId: user.id }, client);
    }
    for (const resourceId of resourceIds) {
      await assessmentRepo.linkResourceToAssessmentQuery(assessment.id, resourceId, client);
    }
    for (const source of [...prepared, ...linkSources.prepared]) {
      const resource = await insertPreparedResource(client, source, { userId: user.id });
      await assessmentRepo.linkResourceToAssessmentQuery(assessment.id, resource.id, client);
    }

    return assessment;
  });

  // After commit: objectives are extracted in the background.
  await requestObjectiveExtraction(created.id);
  const lifecycle = await findAssessmentLifecycleQuery(created.id);
  return { ...created, status: lifecycle.status, objectives_state: lifecycle.objectives_state, skippedLinks: linkSources.skipped };
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
  const linkSources = await prepareLinks(links);

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
      {
        title,
        prompt,
        external_links: links,
        adaptive: adaptiveFlag,
        show_live_score: parseFlag(body.show_live_score),
        negative_marking: parseFlag(body.negative_marking),
      },
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
    for (const source of [...prepared, ...linkSources.prepared]) {
      const resource = await insertPreparedResource(client, source, { userId: user.id });
      await assessmentRepo.linkResourceToAssessmentQuery(existing.id, resource.id, client);
    }

    // Same material, new blocks or adaptivity: keep the objectives, re-plan the blueprint.
    if (!sourcesChanged && (blocks || adaptiveFlag !== undefined)) await recomputeBlueprint(existing.id, client);
    return updated;
  });

  // New material means new objectives (instructor edits to the old ones no longer apply).
  if (sourcesChanged) await requestObjectiveExtraction(existing.id);
  return { ...result, skippedLinks: linkSources.skipped };
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
  await notify(student.id, "enrolled", { assessmentId: assessment.id, title: assessment.title });

  return { enrollment, student: { id: student.id, name: student.name, email: student.email } };
};

/**
 * Enroll every student of a group the requester belongs to (super admin: any
 * group). Students already enrolled are skipped; new ones are emailed and notified.
 */
export const enrollGroupService = async (assessmentId, groupId, user) => {
  const assessment = await requireAssessmentAccess(assessmentId, user);
  const { group, students } = await groupStudentsForEnrollment(user, groupId);
  const instructor = await getUserById(user.id);
  const added = [];
  for (const student of students) {
    const { rows } = await db.query(
      `INSERT INTO enrollments (assessment_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING student_id`,
      [assessment.id, student.id]
    );
    if (rows[0]) added.push(student);
  }
  for (const student of added) {
    sendAssessmentEnrollmentEmail(student, assessment.title, instructor?.name);
    await notify(student.id, "enrolled", { assessmentId: assessment.id, title: assessment.title });
  }
  return { groupId: group.id, groupName: group.name, enrolled: added.length, alreadyEnrolled: students.length - added.length };
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

const PAPER_LANGUAGES = ["en", "ur", "ar", "fa"];
const PAPER_FORMATS = ["pdf", "docx"];

/**
 * Printed paper(s) in `language`: mode "same" (one paper) or "unique" (one
 * different paper per student, coded A, B, C... with a combined answer key),
 * as PDF or DOCX. Header values are printed exactly as typed (proper nouns are
 * never translated). Nothing is written as an attempt.
 */
export const generatePhysicalPaperService = async (assessmentId, user, paperData) => {
  const { language = "en", mode = "same", copies = 1, format = "pdf", form = {}, ...headerInput } = paperData;
  if (!PAPER_LANGUAGES.includes(language)) throw new AppError("UNSUPPORTED_LANGUAGE", 400, "Unsupported language.");
  if (!["same", "unique"].includes(mode)) throw new AppError("INVALID_PAPER", 400, "Unknown paper mode.");
  if (!PAPER_FORMATS.includes(format)) throw new AppError("INVALID_PAPER", 400, "Unknown file format.");

  const owned = await requireAssessmentAccess(assessmentId, user);
  const { rows } = await db.query(`SELECT id, title, prompt, status, blueprint, languages FROM assessments WHERE id = $1`, [owned.id]);
  const sets = await buildPaperSets(rows[0], language, { mode, copies });
  const headers = {
    instituteName: headerInput.instituteName || "",
    teacherName: headerInput.teacherName || "",
    subjectName: headerInput.subjectName || "",
    paperDate: headerInput.paperDate || "",
    paperTime: headerInput.paperTime || "",
    notes: headerInput.notes || "",
  };
  const buffer =
    format === "docx" ? await renderPaperDocx({ sets, headers, language }) : await renderPaperPdf({ sets, headers, form, language });
  return { buffer, format, copies: sets.length };
};
