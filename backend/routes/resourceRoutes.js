// routes/resourceRoutes.js
import express from "express";
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
import { uploadFiles } from "../middleware/uploadMiddleware.js";
import { searchResourcesService } from "../services/resource.service.js";

const router = express.Router();

router.post(
  "/",
  protect,
  authorizeRoles(["instructor", "admin", "super_admin"]),
  uploadFiles.array("files", 10),
  uploadResource
);

router.get(
  "/",
  protect,
  authorizeRoles(["instructor", "admin", "super_admin"]),
  getInstructorResources
);

router.get(
  "/search",
  protect,
  authorizeRoles(["instructor", "admin", "super_admin"]),
  async (req, res, next) => {
    try {
      res.status(200).json({ success: true, data: await searchResourcesService(req.user, req.query) });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/all",
  protect,
  authorizeRoles(["instructor", "admin", "super_admin"]),
  getAllResources
);

router.get(
  "/:resourceId",
  protect,
  authorizeRoles(["instructor", "admin", "super_admin"]),
  getResourceById
);

router.put(
  "/:resourceId",
  protect,
  authorizeRoles(["instructor", "admin", "super_admin"]),
  updateResourceController
);

router.delete(
  "/:resourceId",
  protect,
  authorizeRoles(["instructor", "admin", "super_admin"]),
  deleteResourceController
);

router.post(
  "/:resourceId/assessments/:assessmentId",
  protect,
  authorizeRoles(["instructor", "admin", "super_admin"]),
  linkResourceToAssessmentController
);

router.get(
  "/assessments/:assessmentId",
  protect,
  authorizeRoles(["instructor", "admin", "super_admin"]),
  getAssessmentResourcesController
);

router.delete(
  "/:resourceId/assessments/:assessmentId",
  protect,
  authorizeRoles(["instructor", "admin", "super_admin"]),
  unlinkResourceFromAssessmentController
);

export default router;
