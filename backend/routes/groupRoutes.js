import express from "express";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import {
  listGroupsService,
  createGroupService,
  updateGroupService,
  deleteGroupService,
  listMembersService,
  addMembersService,
  removeMemberService,
} from "../services/group.service.js";

const router = express.Router();
const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    res.status(status).json({ success: true, data: await fn(req) });
  } catch (error) {
    next(error);
  }
};
const superAdmin = authorizeRoles("super_admin");

router.use(protect);

// Reading: super admin sees all groups; admins and instructors see their own.
router.get("/", authorizeRoles("instructor", "admin", "super_admin"), handle((req) => listGroupsService(req.user)));
router.get("/:id/members", authorizeRoles("instructor", "admin", "super_admin"), handle((req) => listMembersService(req.user, req.params.id)));

// Managing groups and memberships: super admin only.
router.post("/", superAdmin, handle((req) => createGroupService(req.user, req.body), 201));
router.put("/:id", superAdmin, handle((req) => updateGroupService(req.user, req.params.id, req.body)));
router.delete("/:id", superAdmin, handle((req) => deleteGroupService(req.user, req.params.id)));
router.post("/:id/members", superAdmin, handle((req) => addMembersService(req.user, req.params.id, req.body?.emails)));
router.delete("/:id/members/:userId", superAdmin, handle((req) => removeMemberService(req.user, req.params.id, req.params.userId)));

export default router;
