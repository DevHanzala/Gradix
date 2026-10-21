import express from "express";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import { getPlatformStatsService } from "../services/platformStats.service.js";

const router = express.Router();

router.get("/stats", protect, authorizeRoles("super_admin"), async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await getPlatformStatsService({ days: req.query.days }) });
  } catch (error) {
    next(error);
  }
});

export default router;
