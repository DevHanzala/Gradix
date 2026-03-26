import * as resourceRepo from "../repositories/resourceRepository.js";
import { validateResourceData, validateResourceUpdate, validateResourceLink } from "../validator/resource.validator.js";

// ==================== RESOURCE CRUD ====================

export const createResource = async (resourceData) => {
  try {
    // VALIDATE DATA BEFORE CREATING
    const validationErrors = validateResourceData(resourceData);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    const resource = await resourceRepo.createResourceQuery(resourceData);
    return resource;
  } catch (error) {
    console.error("Error creating resource:", error);
    throw error;
  }
};

export const findResourcesByUploader = async (uploadedBy, visibility = null) => {
  try {
    const resources = await resourceRepo.findResourcesByUploaderQuery(uploadedBy, visibility);
    return resources;
  } catch (error) {
    console.error("Error fetching resources by uploader:", error);
    throw error;
  }
};

export const findAllResources = async () => {
  try {
    const resources = await resourceRepo.findAllResourcesQuery();
    return resources;
  } catch (error) {
    console.error("Error fetching all resources:", error);
    throw error;
  }
};

export const findResourceById = async (resourceId) => {
  try {
    const resource = await resourceRepo.findResourceByIdQuery(resourceId);
    return resource;
  } catch (error) {
    console.error("Error finding resource by ID:", error);
    throw error;
  }
};

export const updateResource = async (resourceId, updateData) => {
  try {
    // VALIDATE UPDATE DATA
    const validationErrors = validateResourceUpdate(updateData);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    const resource = await resourceRepo.updateResourceQuery(resourceId, updateData);
    if (!resource) {
      throw new Error("Resource not found");
    }
    
    return resource;
  } catch (error) {
    console.error("Error updating resource:", error);
    throw error;
  }
};

export const deleteResource = async (resourceId) => {
  try {
    const resource = await resourceRepo.deleteResourceQuery(resourceId);
    if (!resource) {
      throw new Error("Resource not found");
    }
    
    return resource;
  } catch (error) {
    console.error("Error deleting resource:", error);
    throw error;
  }
};

// ==================== ASSESSMENT RESOURCES ====================

export const linkResourceToAssessment = async (assessmentId, resourceId) => {
  try {
    // VALIDATE LINK DATA
    const validationErrors = validateResourceLink(parseInt(assessmentId), parseInt(resourceId));
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    if (!resourceId || isNaN(parseInt(resourceId))) {
      throw new Error(`Invalid resourceId: ${resourceId}`);
    }
    
    const resource = await resourceRepo.findResourceByIdQuery(resourceId);
    if (!resource) {
      throw new Error(`Resource not found: ID=${resourceId}`);
    }
    
    const link = await resourceRepo.linkResourceToAssessmentQuery(assessmentId, resourceId);
    return link;
  } catch (error) {
    console.error("Error linking resource to assessment:", error);
    throw error;
  }
};

export const getAssessmentResources = async (assessmentId) => {
  try {
    const resources = await resourceRepo.findAssessmentResourcesQuery(assessmentId);
    return resources;
  } catch (error) {
    console.error("Error fetching assessment resources:", error);
    throw error;
  }
};

export const unlinkResourceFromAssessment = async (assessmentId, resourceId) => {
  try {
    const result = await resourceRepo.unlinkResourceFromAssessmentQuery(assessmentId, resourceId);
    if (!result) {
      return null;
    }
    
    return result;
  } catch (error) {
    console.error("Error unlinking resource from assessment:", error);
    throw error;
  }
};