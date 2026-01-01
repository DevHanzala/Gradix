// controllers/resourceController.js
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
import { extractTextFromFile, chunkText } from "../services/textProcessor.js";
import { generateEmbedding } from "../services/embeddingGenerator.js";
import { redis } from "../services/redis.js";
/**
 * UPLOAD RESOURCE (FILES + URL) — IN-MEMORY ONLY
 */


export const uploadResource = async (req, res) => {
  const { name, url, visibility } = req.body;
  const uploadedBy = req.user.id;
  const files = req.files || [];
  const skippedFiles = [];

  if (!files.length && !url) {
    return res.status(400).json({
      success: false,
      message: "No files or URL provided",
    });
  }

  try {
    const uploadedResources = [];

    for (const file of files) {
      const resourceData = {
        name: name || file.originalname,
        file_type: file.mimetype,
        file_size: file.size,
        content_type: "file",
        visibility: visibility || "private",
        uploaded_by: uploadedBy,
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

    if (url) {
      const newResource = await createResource({
        name,
        url,
        content_type: "link",
        visibility: visibility || "private",
        uploaded_by: uploadedBy,
      });
      uploadedResources.push(newResource);
    }

    if (!uploadedResources.length) {
      return res.status(422).json({
        success: false,
        message: "All uploaded files failed during processing",
        skipped: skippedFiles,
      });
    }


    await redis.del(`resources:instructor:${uploadedBy}:visibility:all`);
    await redis.del(`resources:instructor:${uploadedBy}:visibility:private`);
    await redis.del(`resources:instructor:${uploadedBy}:visibility:public`);

    res.status(201).json({
      success: true,
      message: "Resources uploaded successfully",
      resources: uploadedResources,
      skipped: skippedFiles,
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Resource processing failed",
    });
  }
};

/**
 * GET INSTRUCTOR'S RESOURCES
 */
export const getInstructorResources = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const visibility = req.query.visibility || "all"; // "all", "private", "public"

    // REDIS CACHE KEY — UNIQUE FOR EACH VISIBILITY
    const cacheKey = `resources:instructor:${instructorId}:visibility:${visibility}`;

    // CHECK REDIS FIRST — INSTANT
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`Resources from Redis: ${cacheKey}`);
      return res.json({
        success: true,
        message: "Resources retrieved",
        data: cached
      });
    }

    // IF NOT CACHED → GET FROM DB
    console.log(`Fetching resources from DB for instructor ${instructorId} (${visibility})`);
    const resources = await findResourcesByUploader(instructorId, visibility === "all" ? null : visibility);

    // CACHE FOR 10 MINUTES
    await redis.set(cacheKey, resources || [], { ex: 600 });

    res.json({
      success: true,
      message: "Resources retrieved",
      data: resources || []
    });
  } catch (error) {
    console.error("Get instructor resources error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve resources"
    });
  }
};


/**
 * GET ALL SYSTEM RESOURCES (FILE-BASED)
 */
export const getAllResources = async (req, res) => {
  try {
    const resources = await findAllResources();
    res.json({ success: true, message: "System resources retrieved", data: resources || [] });
  } catch (error) {
    console.error("Get all resources error:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve system resources" });
  }
};

/**
 * GET RESOURCE BY ID
 */
export const getResourceById = async (req, res) => {
  try {
    const resource = await findResourceById(req.params.resourceId);
    if (!resource) return res.status(404).json({ success: false, message: "Resource not found" });

    if (req.user.role === "instructor" && resource.uploaded_by !== Number(req.user.id)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    res.json({ success: true, message: "Resource retrieved", data: resource });
  } catch (error) {
    console.error("Get resource error:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve resource" });
  }
};

/**
 * UPDATE RESOURCE
 */
export const updateResourceController = async (req, res) => {
  try {
    const resource = await findResourceById(req.params.resourceId);
    if (!resource) return res.status(404).json({ success: false, message: "Resource not found" });

    if (req.user.role === "instructor" && resource.uploaded_by !== Number(req.user.id)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const updated = await updateResource(req.params.resourceId, req.body);
    await redis.del(`resources:instructor:${req.user.id}:visibility:all`);
    await redis.del(`resources:instructor:${req.user.id}:visibility:private`);
    await redis.del(`resources:instructor:${req.user.id}:visibility:public`);

    res.json({ success: true, message: "Resource updated", data: updated });
  } catch (error) {
    console.error("Update resource error:", error);
    res.status(500).json({ success: false, message: "Failed to update resource" });
  }
};

/**
 * DELETE RESOURCE
 */
export const deleteResourceController = async (req, res) => {
  try {
    const resource = await findResourceById(req.params.resourceId);
    if (!resource) return res.status(404).json({ success: false, message: "Resource not found" });

    if (req.user.role === "instructor" && resource.uploaded_by !== Number(req.user.id)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    await deleteResource(req.params.resourceId);
    await redis.del(`resources:instructor:${req.user.id}:visibility:all`);
    await redis.del(`resources:instructor:${req.user.id}:visibility:private`);
    await redis.del(`resources:instructor:${req.user.id}:visibility:public`);
    res.json({ success: true, message: "Resource deleted successfully" });
  } catch (error) {
    console.error("Delete resource error:", error);
    res.status(500).json({ success: false, message: "Failed to delete resource" });
  }
};

/**
 * LINK RESOURCE TO ASSESSMENT
 */
export const linkResourceToAssessmentController = async (req, res) => {
  try {
    const { resourceId, assessmentId } = req.params;
    const assessment = await getAssessmentById(assessmentId, req.user.id, req.user.role);
    if (!assessment) return res.status(404).json({ success: false, message: "Assessment not found or access denied" });

    const resource = await findResourceById(resourceId);
    if (!resource) return res.status(404).json({ success: false, message: "Resource not found" });

    const link = await linkResourceToAssessment(assessmentId, resourceId);
    res.json({ success: true, message: "Resource linked", data: link });
  } catch (error) {
    console.error("Link resource error:", error);
    res.status(500).json({ success: false, message: "Failed to link resource" });
  }
};

/**
 * GET ASSESSMENT RESOURCES
 */
export const getAssessmentResourcesController = async (req, res) => {
  try {
    const assessment = await getAssessmentById(req.params.assessmentId, req.user.id, req.user.role);
    if (!assessment) return res.status(404).json({ success: false, message: "Assessment not found or access denied" });

    const resources = await getAssessmentResources(req.params.assessmentId);
    res.json({ success: true, message: "Resources retrieved", data: resources || [] });
  } catch (error) {
    console.error("Get assessment resources error:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve assessment resources" });
  }
};

/**
 * UNLINK RESOURCE FROM ASSESSMENT
 */
export const unlinkResourceFromAssessmentController = async (req, res) => {
  try {
    const { resourceId, assessmentId } = req.params;
    const assessment = await getAssessmentById(assessmentId, req.user.id, req.user.role);
    if (!assessment) return res.status(404).json({ success: false, message: "Assessment not found or access denied" });

    const result = await unlinkResourceFromAssessment(assessmentId, resourceId);
    if (!result) return res.status(404).json({ success: false, message: "Resource not linked" });

    res.json({ success: true, message: "Resource unlinked successfully" });
  } catch (error) {
    console.error("Unlink resource error:", error);
    res.status(500).json({ success: false, message: "Failed to unlink resource" });
  }
};