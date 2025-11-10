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

/**
 * UPLOAD RESOURCE (FILES + URL) — IN-MEMORY ONLY
 */
export const uploadResource = async (req, res) => {
  const { name, url, visibility } = req.body;
  const uploadedBy = req.user.id;
  const files = req.files || [];

  try {
    console.log(`Uploading resources for user ${uploadedBy}`);
    const uploadedResources = [];

    // === HANDLE FILE UPLOADS (IN-MEMORY) ===
    for (const file of files) {
      const resourceData = {
        name: name || file.originalname,
        file_type: file.mimetype,
        file_size: file.size,
        content_type: "file",
        visibility: visibility || "private",
        uploaded_by: uploadedBy,
      };

      const newResource = await createResource(resourceData);

      // Extract text from buffer
      const text = await extractTextFromFile(file.buffer, file.mimetype);
      const chunks = chunkText(text, 500);

      // Generate embeddings & save chunks
      for (let i = 0; i < chunks.length; i++) {
        const embedding = await generateEmbedding(chunks[i]);
        await storeResourceChunk(newResource.id, chunks[i], embedding, { chunk_index: i });
      }

      uploadedResources.push(newResource);
    }

    // === HANDLE URL RESOURCE ===
    if (url) {
      if (!name) {
        return res.status(400).json({ success: false, message: "Name is required for URL resource." });
      }

      const resourceData = {
        name,
        url,
        content_type: "link",
        visibility: visibility || "private",
        uploaded_by: uploadedBy,
      };

      const newResource = await createResource(resourceData);
      uploadedResources.push(newResource);
    }

    if (uploadedResources.length === 0) {
      return res.status(400).json({ success: false, message: "No files or URL provided." });
    }

    console.log(`${uploadedResources.length} resource(s) uploaded successfully`);
    res.status(201).json({
      success: true,
      message: "Resources uploaded successfully",
      resources: uploadedResources,
    });
  } catch (error) {
    console.error("Upload resource error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload resources",
      error: error.message,
    });
  }
};

/**
 * GET INSTRUCTOR'S RESOURCES
 */
export const getInstructorResources = async (req, res) => {
  try {
    const resources = await findResourcesByUploader(req.user.id, req.query.visibility || null);
    res.json({ success: true, message: "Resources retrieved", data: resources || [] });
  } catch (error) {
    console.error("Get instructor resources error:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve resources" });
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