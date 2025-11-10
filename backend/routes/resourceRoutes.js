// routes/resourceRoutes.js
import express from "express";
import multer from "multer";
import {
  uploadResource,
  getInstructorResources,
  getAllResources,
  getResourceById,
  updateResourceController,
  deleteResourceController,
  linkResourceToAssessmentController,
  getAssessmentResourcesController,
  unlinkResourceFromAssessmentController,
} from "../controllers/resourceController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

// IN-MEMORY ONLY → NO DISK, NO FOLDER
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error("Invalid file type"), false);
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/**
 * @route   POST /api/resources
 * @desc    Upload a new resource (in-memory)
 * @access  Private
 */
router.post(
  "/",
  protect,
  authorizeRoles(["instructor", "admin", "super_admin"]),
  upload.array("files", 10),
  uploadResource
);

/**
 * @route   GET /api/resources
 * @desc    Get instructor's resources
 */
router.get(
  "/",
  protect,
  authorizeRoles(["instructor", "admin", "super_admin"]),
  getInstructorResources
);

/**
 * @route   GET /api/resources/all
 * @desc    Get all file-based resources
 */
router.get(
  "/all",
  protect,
  authorizeRoles(["instructor", "admin", "super_admin"]),
  getAllResources
);

/**
 * @route   GET /api/resources/:resourceId
 */
router.get(
  "/:resourceId",
  protect,
  authorizeRoles(["instructor", "admin", "super_admin"]),
  getResourceById
);

/**
 * @route   PUT /api/resources/:resourceId
 */
router.put(
  "/:resourceId",
  protect,
  authorizeRoles(["instructor", "admin", "super_admin"]),
  updateResourceController
);

/**
 * @route   DELETE /api/resources/:resourceId
 */
router.delete(
  "/:resourceId",
  protect,
  authorizeRoles(["instructor", "admin", "super_admin"]),
  deleteResourceController
);

/**
 * @route   POST /api/resources/:resourceId/assessments/:assessmentId
 */
router.post(
  "/:resourceId/assessments/:assessmentId",
  protect,
  authorizeRoles(["instructor", "admin", "super_admin"]),
  linkResourceToAssessmentController
);

/**
 * @route   GET /api/resources/assessments/:assessmentId
 */
router.get(
  "/assessments/:assessmentId",
  protect,
  authorizeRoles(["instructor", "admin", "super_admin"]),
  getAssessmentResourcesController
);

/**
 * @route   DELETE /api/resources/:resourceId/assessments/:assessmentId
 */
router.delete(
  "/:resourceId/assessments/:assessmentId",
  protect,
  authorizeRoles(["instructor", "admin", "super_admin"]),
  unlinkResourceFromAssessmentController
);

export default router;