import {
  createResource,
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
import { prepareUploadedFile, insertPreparedResource, decodeFilename } from "../helper/resourceIngest.js";
import { withTransaction } from "../DB/db.js";

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
    let parsed;
    try {
      parsed = new URL(String(url).trim());
    } catch {
      throw new AppError("INVALID_URL", 400, "Please enter a valid link.");
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new AppError("INVALID_URL", 400, "Links must start with http:// or https://.");
    }
    const resource = await createResource({
      name: (name && String(name).trim()) || parsed.hostname,
      url: parsed.toString(),
      content_type: "link",
      visibility,
      uploaded_by: userId,
    });
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
