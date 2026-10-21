import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { listNotificationsService, markReadService, markAllReadService } from "../services/notification.service.js";

const router = express.Router();
const handle = (fn) => async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: await fn(req) });
  } catch (error) {
    next(error);
  }
};

router.use(protect);
router.get("/", handle((req) => listNotificationsService(req.user.id)));
router.post("/read-all", handle((req) => markAllReadService(req.user.id)));
router.post("/:id/read", handle((req) => markReadService(req.user.id, req.params.id)));

export default router;
