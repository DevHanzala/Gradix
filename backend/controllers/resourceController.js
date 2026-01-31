// RESOURCE CONTROLLER - Request/Response Handler Layer
import {
  uploadResourceService,
  getInstructorResourcesService,
  getAllResourcesService,
  getResourceByIdService,
  updateResourceService,
  deleteResourceService,
  linkResourceToAssessmentService,
  getAssessmentResourcesService,
  unlinkResourceFromAssessmentService,
} from "../services/resource.service.js";

// ==================== CONTROLLER FUNCTIONS ====================

// 1. UPLOAD RESOURCE (FILES + URL)
export const uploadResource = async (req, res) => {
  const { name, url, visibility } = req.body;
  const uploadedBy = req.user?.id;
  const files = req.files || [];

  try {
    const { uploadedResources, skippedFiles } = await uploadResourceService(
      { name, url, visibility },
      uploadedBy,
      files
    );

    res.status(201).json({
      success: true,
      message: "Resources uploaded successfully",
      resources: uploadedResources,
      skipped: skippedFiles,
    });
  } catch (error) {
    console.error("Upload resource error:", error);

    if (error.message === "NO_FILES_OR_URL") {
      return res.status(400).json({
        success: false,
        message: "No files or URL provided",
      });
    }

    if (error.message === "ALL_FILES_FAILED") {
      return res.status(422).json({
        success: false,
        message: "All uploaded files failed during processing",
      });
    }

    res.status(400).json({
      success: false,
      message: error.message || "Resource processing failed",
    });
  }
};

// 2. GET INSTRUCTOR'S RESOURCES
export const getInstructorResources = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const visibility = req.query.visibility || "all";

    const { data } = await getInstructorResourcesService(
      instructorId,
      visibility
    );

    res.json({
      success: true,
      message: "Resources retrieved",
      data,
    });

    console.log("[GET /resources]", {
      userId: req.user.id,
      role: req.user.role,
      visibility: req.query.visibility,
    });
  } catch (error) {
    console.error("Get instructor resources error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve resources",
    });
  }
};

// 3. GET ALL SYSTEM RESOURCES (FILE-BASED)
export const getAllResources = async (req, res) => {
  try {
    const resources = await getAllResourcesService();

    res.json({
      success: true,
      message: "System resources retrieved",
      data: resources,
    });
  } catch (error) {
    console.error("Get all resources error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve system resources",
    });
  }
};

// 4. GET RESOURCE BY ID
export const getResourceById = async (req, res) => {
  try {
    const resource = await getResourceByIdService(
      req.params.resourceId,
      req.user.id,
      req.user.role
    );

    res.json({
      success: true,
      message: "Resource retrieved",
      data: resource,
    });
  } catch (error) {
    console.error("Get resource error:", error);

    if (error.message === "RESOURCE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Resource not found",
      });
    }

    if (error.message === "ACCESS_DENIED") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to retrieve resource",
    });
  }
};

// 5. UPDATE RESOURCE
export const updateResourceController = async (req, res) => {
  try {
    const updated = await updateResourceService(
      req.params.resourceId,
      req.body,
      req.user.id,
      req.user.role
    );

    res.json({
      success: true,
      message: "Resource updated",
      data: updated,
    });
  } catch (error) {
    console.error("Update resource error:", error);

    if (error.message === "RESOURCE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Resource not found",
      });
    }

    if (error.message === "ACCESS_DENIED") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update resource",
    });
  }
};

// 6. DELETE RESOURCE
export const deleteResourceController = async (req, res) => {
  try {
    await deleteResourceService(
      req.params.resourceId,
      req.user.id,
      req.user.role
    );

    res.json({
      success: true,
      message: "Resource deleted successfully",
    });
  } catch (error) {
    console.error("Delete resource error:", error);

    if (error.message === "RESOURCE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Resource not found",
      });
    }

    if (error.message === "ACCESS_DENIED") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to delete resource",
    });
  }
};

// 7. LINK RESOURCE TO ASSESSMENT
export const linkResourceToAssessmentController = async (req, res) => {
  try {
    const { resourceId, assessmentId } = req.params;

    const link = await linkResourceToAssessmentService(
      resourceId,
      assessmentId,
      req.user.id,
      req.user.role
    );

    res.json({
      success: true,
      message: "Resource linked",
      data: link,
    });
  } catch (error) {
    console.error("Link resource error:", error);

    if (error.message === "ASSESSMENT_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Assessment not found or access denied",
      });
    }

    if (error.message === "RESOURCE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Resource not found",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to link resource",
    });
  }
};

// 8. GET ASSESSMENT RESOURCES
export const getAssessmentResourcesController = async (req, res) => {
  try {
    const resources = await getAssessmentResourcesService(
      req.params.assessmentId,
      req.user.id,
      req.user.role
    );

    res.json({
      success: true,
      message: "Resources retrieved",
      data: resources,
    });
  } catch (error) {
    console.error("Get assessment resources error:", error);

    if (error.message === "ASSESSMENT_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Assessment not found or access denied",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to retrieve assessment resources",
    });
  }
};

// 9. UNLINK RESOURCE FROM ASSESSMENT
export const unlinkResourceFromAssessmentController = async (req, res) => {
  try {
    const { resourceId, assessmentId } = req.params;

    await unlinkResourceFromAssessmentService(
      resourceId,
      assessmentId,
      req.user.id,
      req.user.role
    );

    res.json({
      success: true,
      message: "Resource unlinked successfully",
    });
  } catch (error) {
    console.error("Unlink resource error:", error);

    if (error.message === "ASSESSMENT_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Assessment not found or access denied",
      });
    }

    if (error.message === "RESOURCE_NOT_LINKED") {
      return res.status(404).json({
        success: false,
        message: "Resource not linked",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to unlink resource",
    });
  }
};