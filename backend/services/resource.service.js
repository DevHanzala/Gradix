import {
  findResourcesByUploader,
  findResourceById,
  updateResource,
  deleteResource,
  linkResourceToAssessment,
  getAssessmentResources,
  unlinkResourceFromAssessment,
  findAllResources,
} from "../models/resourceModel.js";
import { requireAssessmentAccess } from "./assessmentAccess.js";
import { AppError } from "../utils/AppError.js";
import { prepareUploadedFile, insertPreparedResource, decodeFilename, prepareLink } from "../helper/resourceIngest.js";
import db, { withTransaction } from "../DB/db.js";

// ==================== SERVICE FUNCTIONS ====================

// 1. UPLOAD RESOURCE SERVICE
// Each file is prepared (text, chunks, embeddings) before any write and then
// inserted in its own transaction. Unreadable files are reported, not fatal.
export const uploadResourceService = async (data, userId, files) => {
  const { name, url, visibility = "private" } = data || {};
  const uploadedFiles = files || [];
  const skippedFiles = [];

  if (!["private", "public"].includes(visibility)) {
    throw new AppError("INVALID_VISIBILITY", 400, "Visibility must be private or public.");
  }
  if (!uploadedFiles.length && !url) {
    throw new Error("NO_FILES_OR_URL");
  }

  const uploadedResources = [];

  for (const file of uploadedFiles) {
    let prepared;
    try {
      prepared = await prepareUploadedFile(file);
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      skippedFiles.push({ file: decodeFilename(file.originalname), reason: error.message });
      continue;
    }
    const resource = await withTransaction((client) =>
      insertPreparedResource(client, prepared, {
        userId,
        visibility,
        name: uploadedFiles.length === 1 ? name : undefined,
      })
    );
    uploadedResources.push(resource);
  }

  if (url) {
    // The page or video transcript is read and indexed like a file.
    const prepared = await prepareLink(url);
    const resource = await withTransaction((client) => insertPreparedResource(client, prepared, { userId, visibility, name }));
    uploadedResources.push(resource);
  }

  if (!uploadedResources.length) {
    throw new AppError(
      "ALL_FILES_FAILED",
      422,
      skippedFiles.map((f) => f.reason).join(" ") || "None of the files could be processed."
    );
  }

  return { uploadedResources, skippedFiles };
};

// 2. GET INSTRUCTOR RESOURCES SERVICE
export const getInstructorResourcesService = async (
  instructorId,
  visibility = "all"
) => {
  const dbVisibility = visibility === "all" ? null : visibility;


  const resources = await findResourcesByUploader(
    instructorId,
    dbVisibility
  );

  return {
    data: resources || [],
    fromCache: false,
  };
};


// 3. GET ALL RESOURCES SERVICE
export const getAllResourcesService = async (userId) => {
  const resources = await findAllResources(userId);
  return resources || [];
};

/**
 * Library search: own resources (plus public ones with scope "all"), with
 * text search, filters and pagination. Never returns the full text.
 */
export const searchResourcesService = async (user, query = {}) => {
  const params = [user.id];
  const where = [query.scope === "all" ? "(r.uploaded_by = $1 OR r.visibility = 'public')" : "r.uploaded_by = $1"];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replaceAll("?", `$${params.length}`));
  };
  if (query.search) add("(r.name ILIKE ? OR r.content_text ILIKE ?)", `%${String(query.search).slice(0, 200)}%`);
  if (["file", "link"].includes(query.type)) add("r.content_type = ?", query.type);
  if (["private", "public"].includes(query.visibility)) add("r.visibility = ?", query.visibility);
  if (["en", "ur", "ar", "fa"].includes(query.language)) add("r.language = ?", query.language);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.page_size, 10) || 20));
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const sql = where.join(" AND ");
  const total = (await db.query(`SELECT count(*)::int AS n FROM resources r WHERE ${sql}`, params)).rows[0].n;
  const { rows } = await db.query(
    `SELECT r.id, r.name, r.url, r.file_type, r.file_size, r.content_type, r.visibility, r.language, r.extraction_method,
            r.created_at, r.uploaded_by, u.name AS uploader_name,
            (SELECT count(*)::int FROM resource_chunks rc WHERE rc.resource_id = r.id) AS chunk_count
     FROM resources r JOIN users u ON u.id = r.uploaded_by
     WHERE ${sql}
     ORDER BY r.created_at DESC, r.id DESC
     LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    params
  );
  return { items: rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
};

// 4. GET RESOURCE BY ID SERVICE
export const getResourceByIdService = async (resourceId, userId, userRole) => {
  const resource = await findResourceById(resourceId);
  
  if (!resource) {
    throw new Error("RESOURCE_NOT_FOUND");
  }

  if (!canUseResource(resource, { id: userId, role: userRole })) {
    throw new Error("ACCESS_DENIED");
  }

  return resource;
};

// 5. UPDATE RESOURCE SERVICE
export const updateResourceService = async (resourceId, updateData, userId, userRole) => {
  const resource = await findResourceById(resourceId);
  
  if (!resource) {
    throw new Error("RESOURCE_NOT_FOUND");
  }

  if (userRole === "instructor" && resource.uploaded_by !== Number(userId)) {
    throw new Error("ACCESS_DENIED");
  }

  const updated = await updateResource(resourceId, updateData);

  return updated;
};

// 6. DELETE RESOURCE SERVICE
export const deleteResourceService = async (resourceId, userId, userRole) => {
  const resource = await findResourceById(resourceId);
  
  if (!resource) {
    throw new Error("RESOURCE_NOT_FOUND");
  }

  if (userRole === "instructor" && resource.uploaded_by !== Number(userId)) {
    throw new Error("ACCESS_DENIED");
  }

  await deleteResource(resourceId);

  return { success: true };
};

// 7. LINK RESOURCE TO ASSESSMENT SERVICE
export const linkResourceToAssessmentService = async (resourceId, assessmentId, userId, userRole) => {
  await requireAssessmentAccess(assessmentId, { id: userId, role: userRole }, { lockAfterExecution: true });

  await assertResourcesUsable([resourceId], { id: userId, role: userRole });

  const link = await linkResourceToAssessment(assessmentId, resourceId);
  return link;
};

// 8. GET ASSESSMENT RESOURCES SERVICE
export const getAssessmentResourcesService = async (assessmentId, userId, userRole) => {
  await requireAssessmentAccess(assessmentId, { id: userId, role: userRole });

  const resources = await getAssessmentResources(assessmentId);
  return resources || [];
};

// 9. UNLINK RESOURCE FROM ASSESSMENT SERVICE
export const unlinkResourceFromAssessmentService = async (resourceId, assessmentId, userId, userRole) => {
  await requireAssessmentAccess(assessmentId, { id: userId, role: userRole }, { lockAfterExecution: true });

  const result = await unlinkResourceFromAssessment(assessmentId, resourceId);
  
  if (!result) {
    throw new Error("RESOURCE_NOT_LINKED");
  }

  return { success: true };
};

// ==================== ACCESS HELPERS ====================

/** A resource is usable by its uploader, by a super_admin, or by anyone if public. */
export const canUseResource = (resource, user) =>
  resource.visibility === "public" ||
  resource.uploaded_by === Number(user.id) ||
  user.role === "super_admin";

/** Throw unless every id refers to a resource the user may attach to an assessment. */
export const assertResourcesUsable = async (resourceIds, user) => {
  for (const rawId of resourceIds || []) {
    const id = Number.parseInt(rawId, 10);
    const resource = Number.isInteger(id) ? await findResourceById(id) : null;
    if (!resource) {
      throw new AppError("RESOURCE_NOT_FOUND", 404, `Resource ${rawId} not found`);
    }
    if (!canUseResource(resource, user)) {
      throw new AppError("RESOURCE_FORBIDDEN", 403, `You cannot use resource ${rawId}`);
    }
  }
};
