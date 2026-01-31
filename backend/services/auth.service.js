import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import {
  createUser,
  createGoogleUser,
  findUserByEmail,
  findUserByUID,
  findUserByVerificationToken,
  verifyUser,
  updateResetToken,
  updatePasswordById,
  getAllUsers,
  updateUserRole,
  deleteUser,
  getRecentlyVerifiedUsers,
  findUserByResetToken,
} from "../models/userModel.js";
import { 
  sendVerificationEmail, 
  sendPasswordResetEmail, 
  sendRoleChangeEmail 
} from "../helper/emailService.js";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

// ==================== SERVICE FUNCTIONS ====================

// 1. SIGNUP SERVICE
export const signupService = async (userData) => {
  const { name, email, password, captchaToken } = userData;

  console.log(`Starting signup process for: ${email} | CAPTCHA: ${captchaToken ? "PASSED" : "MISSING"}`);

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    console.warn(`User already exists: ${email}`);
    throw new Error("USER_EXISTS");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  console.log(`Password hashed for: ${email}`);

  const verificationToken = crypto.randomBytes(32).toString("hex");
  console.log(`Generated verification token for ${email}: ${verificationToken.slice(0, 10)}...`);

  const newUser = await createUser(name, email, hashedPassword, "student", verificationToken, "manual", null);
  console.log(`User created:`, {
    id: newUser.id,
    email: newUser.email,
    role: newUser.role,
    verified: newUser.verified,
    provider: newUser.provider,
  });

  try {
    await sendVerificationEmail(email, name, verificationToken);
    console.log(`Verification email sent to ${email}`);
    return { user: newUser, emailSent: true };
  } catch (emailError) {
    console.error("Failed to send verification email:", emailError);
    return { user: newUser, emailSent: false };
  }
};

// 2. GOOGLE AUTH SERVICE
export const googleAuthService = async (googleData) => {
  const { name, email, uid, captchaToken } = googleData;

  console.log(`Starting Google auth for: ${email} | CAPTCHA: ${captchaToken ? "PASSED" : "MISSING"}`);

  let user = await findUserByEmail(email);

  if (user) {
    if (user.provider === "google") {
      console.log(`Existing Google user found: ${email}`);
      if (user.uid !== uid) {
        console.log(`Updating UID for existing Google user: ${email}`);
      }
    } else if (user.provider === "manual") {
      console.log(`Manual user exists, linking with Google: ${email}`);
    }
  } else {
    const userByUID = await findUserByUID(uid);
    if (userByUID) {
      console.warn(`User found by UID but different email: ${email}`);
      throw new Error("GOOGLE_ACCOUNT_LINKED");
    }

    console.log(`Creating new Google user: ${email}`);
    user = await createGoogleUser(name, email, uid, "student");
    console.log(`Google user created:`, {
      id: user.id,
      email: user.email,
      role: user.role,
      provider: user.provider,
      uid: user.uid,
    });
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "24h" });
  console.log(`Generated token for Google auth: ${email}`);

  return { user, token };
};

// 3. LOGIN SERVICE
export const loginService = async (credentials) => {
  const { email, password, captchaToken } = credentials;

  console.log(`Login attempt for: ${email} | CAPTCHA: ${captchaToken ? "PASSED" : "MISSING"}`);

  const user = await findUserByEmail(email);
  if (!user) {
    console.warn(`User not found: ${email}`);
    throw new Error("INVALID_CREDENTIALS");
  }

  console.log(`User found: ${email}, verified: ${user.verified}, provider: ${user.provider}`);

  if (user.provider === "google") {
    console.warn(`Google account detected: ${email}`);
    throw new Error("USE_GOOGLE_SIGNIN");
  }

  if (!user.verified && user.role !== "super_admin") {
    console.warn(`User not verified: ${email}`);
    throw new Error("EMAIL_NOT_VERIFIED");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    console.warn(`Invalid password for: ${email}`);
    throw new Error("INVALID_CREDENTIALS");
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "24h" });
  console.log(`Generated token for login: ${email}`);

  return { user, token };
};

// 4. VERIFY EMAIL SERVICE
export const verifyEmailService = async (token) => {
  console.log(`Attempting to verify token: ${token.slice(0, 10)}...`);

  const user = await findUserByVerificationToken(token);

  if (user) {
    if (user.verified) {
      console.log(`User already verified: ${user.email}`);
      return {
        status: "already_verified",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          verified: user.verified,
        },
      };
    } else {
      const verifiedUser = await verifyUser(token);
      if (verifiedUser) {
        console.log(`Successfully verified user: ${verifiedUser.email}`);
        return {
          status: "just_verified",
          user: {
            id: verifiedUser.id,
            name: verifiedUser.name,
            email: verifiedUser.email,
            role: verifiedUser.role,
            verified: verifiedUser.verified,
          },
        };
      }
    }
  }

  console.log(`Token not found, checking recently verified users...`);
  const recentUsers = await getRecentlyVerifiedUsers();

  if (recentUsers.length > 0) {
    console.log(`Found ${recentUsers.length} recently verified users`);
    return {
      status: "already_used",
      recentlyVerified: true,
    };
  }

  console.warn(`Invalid token: ${token.slice(0, 10)}...`);
  throw new Error("INVALID_TOKEN");
};

// 5. FORGOT PASSWORD SERVICE
export const forgotPasswordService = async (email) => {
  console.log(`Forgot password request for: ${email}`);
  
  const user = await findUserByEmail(email);
  if (!user) {
    console.warn(`User not found: ${email}`);
    return { emailSent: false, userExists: false };
  }

  if (user.provider === "google") {
    console.warn(`Google account detected: ${email}`);
    throw new Error("GOOGLE_USER_NO_RESET");
  }

  const resetId = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 3600000); // 1 hour
  await updateResetToken(email, resetId, expiresAt);
  console.log(`Generated reset token for: ${email}`);

  try {
    await sendPasswordResetEmail(email, user.name, resetId);
    console.log(`Password reset email sent to ${email}`);
    return { emailSent: true, userExists: true };
  } catch (emailError) {
    console.error("Failed to send password reset email:", emailError);
    throw new Error("EMAIL_SEND_FAILED");
  }
};

// 6. CHANGE PASSWORD SERVICE
export const changePasswordService = async (passwordData, authenticatedUser) => {
  const { currentPassword, newPassword, resetId } = passwordData;

  console.log(`Changing password`, { resetId: !!resetId });

  let user;

  if (currentPassword && !resetId) {
    if (!authenticatedUser) {
      console.warn(`Authentication required for password change`);
      throw new Error("AUTH_REQUIRED");
    }
    
    user = await findUserByEmail(authenticatedUser.email);
    if (!user) {
      console.warn(`User not found: ${authenticatedUser.email}`);
      throw new Error("USER_NOT_FOUND");
    }
    
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      console.warn(`Invalid current password for: ${user.email}`);
      throw new Error("INVALID_CURRENT_PASSWORD");
    }
  } else if (resetId && !currentPassword) {
    const resetData = await findUserByResetToken(resetId);
    if (!resetData || new Date() > resetData.reset_token_expires) {
      console.warn(`Invalid or expired reset token: ${resetId.slice(0, 10)}...`);
      throw new Error("INVALID_RESET_TOKEN");
    }
    user = resetData;
  } else {
    console.warn(`Invalid request: currentPassword=${!!currentPassword}, resetId=${!!resetId}`);
    throw new Error("INVALID_REQUEST");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  const updatedUser = await updatePasswordById(user.id, hashedPassword);

  if (!updatedUser) {
    console.error(`Failed to update password for: ${user.email}`);
    throw new Error("PASSWORD_UPDATE_FAILED");
  }

  if (resetId) {
    await updateResetToken(user.email, null, null);
    console.log(`Cleared reset token for: ${user.email}`);
  }

  console.log(`Password changed for: ${user.email}`);
  return { success: true };
};

// 7. GET USERS SERVICE
export const getUsersService = async (userRole, userEmail) => {
  console.log(`Fetching users for: ${userEmail} (${userRole})`);
  
  const users = await getAllUsers(userRole);
  console.log(`Fetched ${users.length} users`);
  
  return users;
};

// 8. CHANGE USER ROLE SERVICE
export const changeUserRoleService = async (roleChangeData, requestingUser) => {
  const { userId, newRole, userEmail } = roleChangeData;

  console.log(`Role change request: User ${userId} to ${newRole} by ${requestingUser.email} (${requestingUser.role})`);

  const userToChange =
    (await findUserByEmail(userEmail)) || (await getAllUsers(requestingUser.role)).find((u) => u.id === userId);

  if (!userToChange) {
    console.warn(`User not found: ID=${userId}, Email=${userEmail}`);
    throw new Error("USER_NOT_FOUND");
  }

  const oldRole = userToChange.role;
  console.log(`Changing ${userToChange.name} from ${oldRole} to ${newRole}`);

  const updatedUser = await updateUserRole(userId, newRole, requestingUser.role);
  if (!updatedUser) {
    console.warn(`Failed to update role for: ${userToChange.email}`);
    throw new Error("USER_NOT_FOUND");
  }

  console.log(`Role changed: ${userToChange.name} is now ${newRole}`);

  try {
    await sendRoleChangeEmail(
      updatedUser.email,
      updatedUser.name,
      oldRole,
      newRole,
      requestingUser.name || "Administrator"
    );
    console.log(`Role change email sent to ${updatedUser.email}`);
  } catch (emailError) {
    console.error("Failed to send role change email:", emailError);
  }

  return updatedUser;
};

// 9. REMOVE USER SERVICE
export const removeUserService = async (userId, requestingUserRole, requestingUserEmail) => {
  console.log(`Delete user request: User ${userId} by ${requestingUserEmail} (${requestingUserRole})`);

  const deletedUser = await deleteUser(Number.parseInt(userId), requestingUserRole);

  if (!deletedUser) {
    console.warn(`User not found: ID=${userId}`);
    throw new Error("USER_NOT_FOUND");
  }

  console.log(`User deleted: ${deletedUser.name}`);
  return deletedUser;
};

// 10. REGISTER STUDENT SERVICE
export const registerStudentService = async (studentData, registrarUser) => {
  const { name, email, password, roles } = studentData;

  console.log(`Registering student by ${registrarUser.email} (${registrarUser.role}):`, {
    name,
    email,
    captcha: "SKIPPED (admin/instructor internal action)"
  });

  if (roles !== undefined) {
    console.error(`Invalid field 'roles' detected: ${JSON.stringify(roles)}`);
    throw new Error("INVALID_ROLES_FIELD");
  }

  if (!["admin", "instructor", "super_admin"].includes(registrarUser.role)) {
    console.warn(`Unauthorized role: ${registrarUser.role}`);
    throw new Error("UNAUTHORIZED_ROLE");
  }

  if (!name || !email || !password) {
    console.warn(`Missing required fields`);
    throw new Error("MISSING_FIELDS");
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    console.warn(`Invalid email format: ${email}`);
    throw new Error("INVALID_EMAIL");
  }

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    console.warn(`User already exists: ${email}`);
    throw new Error("USER_EXISTS");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  console.log(`Password hashed for: ${email}`);

  const verificationToken = crypto.randomBytes(32).toString("hex");
  console.log(`Generated verification token for ${email}`);

  const role = "student";
  const newUser = await createUser(
    name,
    email,
    hashedPassword,
    role,
    verificationToken,
    "manual",
    null
  );

  console.log(`Student created:`, {
    id: newUser.id,
    email: newUser.email,
    role: newUser.role,
  });

  const token = jwt.sign(
    { id: newUser.id, email: newUser.email, role: newUser.role },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
  console.log(`Generated token for student: ${email}`);

  try {
    await sendVerificationEmail(email, name, verificationToken);
    console.log(`Verification email sent to ${email}`);
    return { user: newUser, token, emailSent: true };
  } catch (emailError) {
    console.error("Failed to send verification email:", emailError);
    return { user: newUser, token, emailSent: false };
  }
};

// ==================== HELPER FUNCTIONS ====================

export const formatUserResponse = (user) => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    verified: user.verified,
    provider: user.provider,
  };
};