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
import { getAssessmentById, storeResourceChunk } from "../models/assessmentModel.js";
import { extractTextFromFile, chunkText } from "../helper/textProcessor.js";
import { generateEmbedding } from "../helper/embeddingGenerator.js";
import { redis } from "../DB/redis.js";

// ==================== SERVICE FUNCTIONS ====================

// 1. UPLOAD RESOURCE SERVICE
export const uploadResourceService = async (data, userId, files) => {
  const { name, url, visibility } = data;
  const uploadedFiles = files || [];
  const skippedFiles = [];

  if (!uploadedFiles.length && !url) {
    throw new Error("NO_FILES_OR_URL");
  }

  const uploadedResources = [];

  // Process files
  for (const file of uploadedFiles) {
    const resourceData = {
      name: name || file.originalname,
      file_type: file.mimetype,
      file_size: file.size,
      content_type: "file",
      visibility: visibility || "private",
      uploaded_by: userId,
    };

    let text;
    try {
      text = await extractTextFromFile(file.buffer, file.mimetype);
    } catch (err) {
      skippedFiles.push({
        file: file.originalname,
        reason: err.message,
        stage: "ocr",
      });
      continue;
    }

    const chunks = chunkText(text, 500);
    if (!chunks.length) continue;

    // Pre-flight check: ensure embedding works
    let testEmbedding;
    try {
      testEmbedding = await generateEmbedding(chunks[0]);
    } catch (err) {
      console.warn(`Embedding failed for ${file.originalname}: ${err.message}`);
      skippedFiles.push(file.originalname);
      continue;
    }

    // Only now create resource
    const newResource = await createResource(resourceData);

    // Store first chunk
    await storeResourceChunk(newResource.id, chunks[0], testEmbedding, {
      chunk_index: 0,
    });

    // Store remaining chunks
    for (let i = 1; i < chunks.length; i++) {
      const embedding = await generateEmbedding(chunks[i]);
      await storeResourceChunk(newResource.id, chunks[i], embedding, {
        chunk_index: i,
      });
    }

    uploadedResources.push(newResource);
  }

  // Process URL
  if (url) {
    const newResource = await createResource({
      name,
      url,
      content_type: "link",
      visibility: visibility || "private",
      uploaded_by: userId,
    });
    uploadedResources.push(newResource);
  }

  if (!uploadedResources.length) {
    throw new Error("ALL_FILES_FAILED");
  }

  // Invalidate Redis cache for this instructor
  await clearResourceCache(userId);

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
export const getAllResourcesService = async () => {
  const resources = await findAllResources();
  return resources || [];
};

// 4. GET RESOURCE BY ID SERVICE
export const getResourceByIdService = async (resourceId, userId, userRole) => {
  const resource = await findResourceById(resourceId);
  
  if (!resource) {
    throw new Error("RESOURCE_NOT_FOUND");
  }

  if (userRole === "instructor" && resource.uploaded_by !== Number(userId)) {
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
  
  // Clear cache
  await clearResourceCache(userId);

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
  
  // Clear cache
  await clearResourceCache(userId);

  return { success: true };
};

// 7. LINK RESOURCE TO ASSESSMENT SERVICE
export const linkResourceToAssessmentService = async (resourceId, assessmentId, userId, userRole) => {
  const assessment = await getAssessmentById(assessmentId, userId, userRole);
  
  if (!assessment) {
    throw new Error("ASSESSMENT_NOT_FOUND");
  }

  const resource = await findResourceById(resourceId);
  
  if (!resource) {
    throw new Error("RESOURCE_NOT_FOUND");
  }

  const link = await linkResourceToAssessment(assessmentId, resourceId);
  return link;
};

// 8. GET ASSESSMENT RESOURCES SERVICE
export const getAssessmentResourcesService = async (assessmentId, userId, userRole) => {
  const assessment = await getAssessmentById(assessmentId, userId, userRole);
  
  if (!assessment) {
    throw new Error("ASSESSMENT_NOT_FOUND");
  }

  const resources = await getAssessmentResources(assessmentId);
  return resources || [];
};

// 9. UNLINK RESOURCE FROM ASSESSMENT SERVICE
export const unlinkResourceFromAssessmentService = async (resourceId, assessmentId, userId, userRole) => {
  const assessment = await getAssessmentById(assessmentId, userId, userRole);
  
  if (!assessment) {
    throw new Error("ASSESSMENT_NOT_FOUND");
  }

  const result = await unlinkResourceFromAssessment(assessmentId, resourceId);
  
  if (!result) {
    throw new Error("RESOURCE_NOT_LINKED");
  }

  return { success: true };
};

// ==================== HELPER FUNCTIONS ====================

const clearResourceCache = async (userId) => {
  await redis.del(`resources:instructor:${userId}:visibility:all`);
  await redis.del(`resources:instructor:${userId}:visibility:private`);
  await redis.del(`resources:instructor:${userId}:visibility:public`);
};