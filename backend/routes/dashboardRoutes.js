import express from "express";
import { getInstructorOverview } from "../controllers/dashboardController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @route   GET /api/dashboard
 * @desc    Get instructor dashboard overview
 * @access  Private (Instructor, Admin, Super Admin)
 */
router.get(
  "/",
  protect,
  authorizeRoles(["instructor", "admin", "super_admin"]),
  getInstructorOverview
);

export default router;