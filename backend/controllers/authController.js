import { isAppError } from "../utils/AppError.js";
import {
  signupService,
  googleAuthService,
  loginService,
  verifyEmailService,
  resendVerificationService,
  forgotPasswordService,
  resetPasswordService,
  changePasswordService,
  getUsersService,
  changeUserRoleService,
  removeUserService,
  registerStudentService,
  formatUserResponse,
  setLanguagePreferenceService,
} from "../services/auth.service.js";

/** Map known service error codes to HTTP responses; anything else goes to the error middleware. */
const KNOWN_ERRORS = {
  USER_EXISTS: [400, "User with this email already exists."],
  INVALID_GOOGLE_TOKEN: [401, "Google sign-in could not be verified. Please try again."],
  GOOGLE_ACCOUNT_LINKED: [400, "This Google account is already linked to a different email address."],
  INVALID_TOKEN: [400, "This verification link is invalid or has expired. Request a new one from the login page."],
  INVALID_RESET_TOKEN: [400, "This reset link is invalid or has expired."],
  AUTH_REQUIRED: [401, "Authentication required."],
  USER_NOT_FOUND: [404, "User not found."],
  INVALID_CURRENT_PASSWORD: [400, "Current password is incorrect."],
  PASSWORD_UPDATE_FAILED: [500, "Failed to update password."],
  INVALID_ROLES_FIELD: [400, "Invalid field 'roles'. Omit it; new accounts are always students."],
  UNAUTHORIZED_ROLE: [403, "Only admins, instructors, or super admins can register students."],
  MISSING_FIELDS: [400, "Name, email, and password are required."],
  INVALID_EMAIL: [400, "Invalid email format."],
};

const handleError = (error, res, next) => {
  if (isAppError(error)) return next(error);
  const known = KNOWN_ERRORS[error.message];
  if (known) {
    return res.status(known[0]).json({ success: false, code: error.message, message: known[1] });
  }
  return next(error);
};

export const signup = async (req, res, next) => {
  try {
    const { name, email, password, language } = req.body || {};
    const { user } = await signupService({ name, email, password, language });
    res.status(201).json({
      success: true,
      message: "Account created. Please check your email to verify your account.",
      user: formatUserResponse(user),
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const googleAuth = async (req, res, next) => {
  try {
    const { idToken } = req.body || {};
    const { user, token } = await googleAuthService({ idToken });
    res.status(200).json({
      success: true,
      message: "Google authentication successful",
      user: formatUserResponse(user),
      token,
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const { user, token } = await loginService({ email, password });
    res.status(200).json({
      success: true,
      message: "Logged in successfully",
      user: formatUserResponse(user),
      token,
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    const result = await verifyEmailService(req.params.token);
    res.status(200).json({
      success: true,
      status: result.status,
      message: "Email verified successfully! You can now log in.",
      user: result.user,
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

const GENERIC_EMAIL_RESPONSE = "If an account with that email exists, we have sent an email with further instructions.";

export const resendVerification = async (req, res, next) => {
  try {
    await resendVerificationService(req.body?.email);
    res.status(200).json({ success: true, message: GENERIC_EMAIL_RESPONSE });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    await forgotPasswordService(req.body?.email);
    res.status(200).json({ success: true, message: GENERIC_EMAIL_RESPONSE });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { resetId, newPassword } = req.body || {};
    await resetPasswordService({ resetId, newPassword });
    res.status(200).json({ success: true, message: "Password reset successfully. You can now log in." });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    await changePasswordService({ currentPassword, newPassword }, req.user);
    res.status(200).json({ success: true, message: "Password changed successfully." });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getUsers = async (req, res, next) => {
  try {
    const users = await getUsersService(req.user.role);
    res.status(200).json({ success: true, message: "Users retrieved successfully", users });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const changeUserRole = async (req, res, next) => {
  try {
    const { userId, newRole } = req.body || {};
    const updatedUser = await changeUserRoleService({ userId, newRole }, req.user);
    res.status(200).json({ success: true, message: "User role updated successfully.", user: updatedUser });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const removeUser = async (req, res, next) => {
  try {
    const deletedUser = await removeUserService(req.params.userId, req.user);
    res.status(200).json({ success: true, message: "User deleted successfully.", user: deletedUser });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const setLanguage = async (req, res, next) => {
  try {
    const data = await setLanguagePreferenceService(req.body?.language, req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const registerStudent = async (req, res, next) => {
  try {
    const { name, email, password, roles, language } = req.body || {};
    const { user } = await registerStudentService({ name, email, password, roles, language }, req.user);
    res.status(201).json({
      success: true,
      message: "Student registered successfully. A verification email has been sent.",
      user: formatUserResponse(user),
    });
  } catch (error) {
    handleError(error, res, next);
  }
};
