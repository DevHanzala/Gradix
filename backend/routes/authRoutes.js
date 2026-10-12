import express from "express";
import {
  signup,
  login,
  googleAuth,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  changePassword,
  getUsers,
  changeUserRole,
  removeUser,
  registerStudent,
} from "../controllers/authController.js";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import verifyCaptcha from "../validator/verifyCaptcha.js";
import { authLimiter } from "../middleware/rateLimiters.js";

const router = express.Router();

// ---------- Public (rate limited) ----------
router.post("/signup", authLimiter, verifyCaptcha, signup);
router.post("/login", authLimiter, verifyCaptcha, login);
// Identity is proven by a Firebase ID token verified server-side.
router.post("/google-auth", authLimiter, googleAuth);
router.get("/verify/:token", authLimiter, verifyEmail);
router.post("/resend-verification", authLimiter, resendVerification);
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/reset-password", authLimiter, resetPassword);

// ---------- Authenticated ----------
router.use(protect);

router.post("/change-password", changePassword);
router.post("/register-student", authorizeRoles("admin", "instructor", "super_admin"), registerStudent);
router.get("/users", authorizeRoles("admin", "super_admin"), getUsers);
router.put("/change-role", authorizeRoles("admin", "super_admin"), changeUserRole);
router.delete("/users/:userId", authorizeRoles("super_admin"), removeUser);

export default router;
