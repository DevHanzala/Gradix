import {
  signupService,
  googleAuthService,
  loginService,
  verifyEmailService,
  forgotPasswordService,
  changePasswordService,
  getUsersService,
  changeUserRoleService,
  removeUserService,
  registerStudentService,
  formatUserResponse,
} from "../services/auth.service.js";

// ==================== CONTROLLER FUNCTIONS ====================

// 1. SIGNUP
export const signup = async (req, res) => {
  const { name, email, password, captchaToken } = req.body;

  try {
    const { user, emailSent } = await signupService({ name, email, password, captchaToken });

    if (!emailSent) {
      return res.status(201).json({
        success: true,
        message: "User registered successfully, but verification email could not be sent. Please contact support.",
        user: formatUserResponse(user),
      });
    }

    res.status(201).json({
      success: true,
      message: "User registered successfully. Please check your email to verify your account.",
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error("Signup error:", error.message, error.stack);

    if (error.message === "USER_EXISTS") {
      return res.status(400).json({ 
        success: false, 
        message: "User with this email already exists." 
      });
    }

    res.status(500).json({ 
      success: false, 
      message: "Server error during signup." 
    });
  }
};

// 2. GOOGLE AUTH
export const googleAuth = async (req, res) => {
  const { name, email, uid, captchaToken } = req.body;

  try {
    const { user, token } = await googleAuthService({ name, email, uid, captchaToken });

    res.status(200).json({
      success: true,
      message: "Google authentication successful",
      user: formatUserResponse(user),
      token,
    });
  } catch (error) {
    console.error("Google auth error:", error.message, error.stack);

    if (error.message === "GOOGLE_ACCOUNT_LINKED") {
      return res.status(400).json({
        success: false,
        message: "This Google account is already linked to a different email address.",
      });
    }

    res.status(500).json({ 
      success: false, 
      message: "Server error during Google authentication." 
    });
  }
};

// 3. LOGIN
export const login = async (req, res) => {
  const { email, password, captchaToken } = req.body;

  try {
    const { user, token } = await loginService({ email, password, captchaToken });

    res.status(200).json({
      success: true,
      message: "Logged in successfully",
      user: formatUserResponse(user),
      token,
    });
  } catch (error) {
    console.error("Login error:", error.message, error.stack);

    if (error.message === "INVALID_CREDENTIALS") {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid credentials." 
      });
    }

    if (error.message === "USE_GOOGLE_SIGNIN") {
      return res.status(400).json({ 
        success: false, 
        message: "Please use Google Sign-In for this account." 
      });
    }

    if (error.message === "EMAIL_NOT_VERIFIED") {
      return res.status(400).json({ 
        success: false, 
        message: "Please verify your email before logging in." 
      });
    }

    res.status(500).json({ 
      success: false, 
      message: "Server error during login." 
    });
  }
};

// 4. VERIFY EMAIL
export const verifyEmail = async (req, res) => {
  const { token } = req.params;

  try {
    const result = await verifyEmailService(token);

    if (result.status === "already_verified") {
      return res.status(200).json({
        success: true,
        message: "Your email is already verified! You can log in to your account.",
        user: result.user,
        status: "already_verified",
      });
    }

    if (result.status === "just_verified") {
      return res.status(200).json({
        success: true,
        message: "Email verified successfully! You can now log in.",
        user: result.user,
        status: "just_verified",
      });
    }

    if (result.status === "already_used") {
      return res.status(200).json({
        success: true,
        message: "This verification link has already been used successfully! You can log in to your account.",
        status: "already_used",
        recentlyVerified: true,
      });
    }
  } catch (error) {
    console.error("Email verification error:", error.message, error.stack);

    if (error.message === "INVALID_TOKEN") {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token. Please request a new verification email.",
        status: "invalid_token",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error during email verification.",
      status: "server_error",
    });
  }
};

// 5. FORGOT PASSWORD
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    await forgotPasswordService(email);

    res.status(200).json({
      success: true,
      message: "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error.message, error.stack);

    if (error.message === "GOOGLE_USER_NO_RESET") {
      return res.status(400).json({
        success: false,
        message: "Google users cannot reset password. Please use Google Sign-In.",
      });
    }

    if (error.message === "EMAIL_SEND_FAILED") {
      return res.status(500).json({
        success: false,
        message: "Failed to send password reset email. Please try again or contact support.",
      });
    }

    res.status(500).json({ 
      success: false, 
      message: "Server error during password reset request." 
    });
  }
};

// 6. CHANGE PASSWORD
export const changePassword = async (req, res) => {
  const { currentPassword, newPassword, resetId } = req.body;

  try {
    await changePasswordService(
      { currentPassword, newPassword, resetId },
      req.user
    );

    res.status(200).json({ 
      success: true, 
      message: "Password changed successfully." 
    });
  } catch (error) {
    console.error("Change password error:", error.message, error.stack);

    if (error.message === "AUTH_REQUIRED") {
      return res.status(401).json({ 
        success: false, 
        message: "Authentication required for password change." 
      });
    }

    if (error.message === "USER_NOT_FOUND") {
      return res.status(404).json({ 
        success: false, 
        message: "User not found." 
      });
    }

    if (error.message === "INVALID_CURRENT_PASSWORD") {
      return res.status(400).json({ 
        success: false, 
        message: "Current password is incorrect." 
      });
    }

    if (error.message === "INVALID_RESET_TOKEN") {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid or expired reset link." 
      });
    }

    if (error.message === "INVALID_REQUEST") {
      return res.status(400).json({
        success: false,
        message: "Invalid request. Provide current password or reset ID.",
      });
    }

    if (error.message === "PASSWORD_UPDATE_FAILED") {
      return res.status(500).json({ 
        success: false, 
        message: "Failed to update password." 
      });
    }

    res.status(500).json({ 
      success: false, 
      message: "Server error during password change." 
    });
  }
};

// 7. GET USERS
export const getUsers = async (req, res) => {
  try {
    const users = await getUsersService(req.user.role, req.user.email);

    res.status(200).json({ 
      success: true, 
      message: "Users retrieved successfully", 
      users 
    });
  } catch (error) {
    console.error("Get users error:", error.message, error.stack);
    res.status(500).json({ 
      success: false, 
      message: "Server error while fetching users." 
    });
  }
};

// 8. CHANGE USER ROLE
export const changeUserRole = async (req, res) => {
  const { userId, newRole, userEmail } = req.body;

  try {
    const updatedUser = await changeUserRoleService(
      { userId, newRole, userEmail },
      req.user
    );

    res.status(200).json({
      success: true,
      message: "User role updated successfully.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Change user role error:", error.message, error.stack);

    if (error.message === "USER_NOT_FOUND") {
      return res.status(404).json({ 
        success: false, 
        message: "User not found." 
      });
    }

    res.status(400).json({ 
      success: false, 
      message: error.message || "Server error while updating user role." 
    });
  }
};

// 9. REMOVE USER
export const removeUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const deletedUser = await removeUserService(
      userId,
      req.user.role,
      req.user.email
    );

    res.status(200).json({
      success: true,
      message: "User deleted successfully.",
      user: deletedUser,
    });
  } catch (error) {
    console.error("Delete user error:", error.message, error.stack);

    if (error.message === "USER_NOT_FOUND") {
      return res.status(404).json({ 
        success: false, 
        message: "User not found." 
      });
    }

    res.status(400).json({ 
      success: false, 
      message: error.message || "Server error while deleting user." 
    });
  }
};

// 10. REGISTER STUDENT
export const registerStudent = async (req, res) => {
  const { name, email, password, roles } = req.body;

  try {
    const { user, token, emailSent } = await registerStudentService(
      { name, email, password, roles },
      req.user
    );

    if (!emailSent) {
      return res.status(201).json({
        success: true,
        message: "Student registered successfully, but verification email could not be sent.",
        user: formatUserResponse(user),
        token,
      });
    }

    res.status(201).json({
      success: true,
      message: "Student registered successfully. Verification email sent.",
      user: formatUserResponse(user),
      token,
    });
  } catch (error) {
    console.error("Register student error:", error.message, error.stack);

    if (error.message === "INVALID_ROLES_FIELD") {
      return res.status(400).json({
        success: false,
        message: "Invalid field 'roles'. Use 'role' as a string or omit it (defaults to 'student').",
      });
    }

    if (error.message === "UNAUTHORIZED_ROLE") {
      return res.status(403).json({
        success: false,
        message: "Only admins, instructors, or super admins can register students.",
      });
    }

    if (error.message === "MISSING_FIELDS") {
      return res.status(400).json({ 
        success: false, 
        message: "Name, email, and password are required." 
      });
    }

    if (error.message === "INVALID_EMAIL") {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid email format." 
      });
    }

    if (error.message === "USER_EXISTS") {
      return res.status(400).json({ 
        success: false, 
        message: "User with this email already exists." 
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Server error during student registration.",
    });
  }
};