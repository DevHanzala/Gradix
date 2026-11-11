import express from "express";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import { PLANS } from "../config/plans.js";
import {
  accountUsage,
  accountsOverviewService,
  groupsPlansService,
  setUserPlanService,
  setGroupPlanService,
} from "../services/plans.service.js";

/** Plans: public price list, the instructor's own usage, and Super Admin assignment. */
const router = express.Router();
const handle = (fn) => async (req, res, next) => {
  try {
    res.json({ success: true, data: await fn(req) });
  } catch (error) {
    next(error);
  }
};
const superAdmin = [protect, authorizeRoles("super_admin")];

router.get("/", handle(() => Object.values(PLANS)));
router.get("/me", protect, handle((req) => accountUsage(req.user.id)));
router.get("/accounts", ...superAdmin, handle(() => accountsOverviewService()));
router.get("/groups", ...superAdmin, handle(() => groupsPlansService()));
router.put("/users/:id", ...superAdmin, handle((req) => setUserPlanService(Number.parseInt(req.params.id, 10) || 0, req.body?.plan)));
router.put("/groups/:id", ...superAdmin, handle((req) => setGroupPlanService(Number.parseInt(req.params.id, 10) || 0, req.body?.plan ?? null)));

export default router;
