import express from "express";
import {
  signup,
  login,
  googleAuth,
  verifyEmail,
  forgotPassword,
  getUsers,
  changeUserRole,
  removeUser,
  registerStudent,
  changePassword,
} from "../controllers/authController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import verifyCaptcha from "../middleware/verifyCaptcha.js";

const router = express.Router();

// Public routes with CAPTCHA
router.post("/signup", verifyCaptcha, signup);
router.post("/login", verifyCaptcha, login);

// Google Auth — NO CAPTCHA (trusted by Google)
router.post("/google-auth", googleAuth);  // ← REMOVED verifyCaptcha

router.get("/verify/:token", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.post("/change-password", changePassword);

// Protected routes
router.use(protect);

router.post("/register-student", authorizeRoles("admin", "instructor", "super_admin"), registerStudent);
router.get("/users", authorizeRoles("admin", "super_admin"), getUsers);
router.put("/change-role", authorizeRoles("admin", "super_admin"), changeUserRole);
router.delete("/users/:userId", authorizeRoles("super_admin"), removeUser);

export default router;