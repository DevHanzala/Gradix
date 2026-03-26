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


  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    console.warn(`User already exists: ${email}`);
    throw new Error("USER_EXISTS");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const verificationToken = crypto.randomBytes(32).toString("hex");

  const newUser = await createUser(name, email, hashedPassword, "student", verificationToken, "manual", null);

  try {
    await sendVerificationEmail(email, name, verificationToken);
    return { user: newUser, emailSent: true };
  } catch (emailError) {
    console.error("Failed to send verification email:", emailError);
    return { user: newUser, emailSent: false };
  }
};

// 2. GOOGLE AUTH SERVICE
export const googleAuthService = async (googleData) => {
  const { name, email, uid, captchaToken } = googleData;

  let user = await findUserByEmail(email);

  if (user) {
    if (user.provider === "google") {
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

    user = await createGoogleUser(name, email, uid, "student");
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "24h" });

  return { user, token };
};

// 3. LOGIN SERVICE
export const loginService = async (credentials) => {
  const { email, password, captchaToken } = credentials;

  const user = await findUserByEmail(email);
  if (!user) {
    console.warn(`User not found: ${email}`);
    throw new Error("INVALID_CREDENTIALS");
  }

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

  return { user, token };
};

// 4. VERIFY EMAIL SERVICE
export const verifyEmailService = async (token) => {
  const user = await findUserByVerificationToken(token);

  if (user) {
    if (user.verified) {
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

  const recentUsers = await getRecentlyVerifiedUsers();

  if (recentUsers.length > 0) {
    return {
      status: "already_used",
      recentlyVerified: true,
    };
  }

  throw new Error("INVALID_TOKEN");
};

// 5. FORGOT PASSWORD SERVICE
export const forgotPasswordService = async (email) => {
  
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
  try {
    await sendPasswordResetEmail(email, user.name, resetId);
    return { emailSent: true, userExists: true };
  } catch (emailError) {
    console.error("Failed to send password reset email:", emailError);
    throw new Error("EMAIL_SEND_FAILED");
  }
};

// 6. CHANGE PASSWORD SERVICE
export const changePasswordService = async (passwordData, authenticatedUser) => {
  const { currentPassword, newPassword, resetId } = passwordData;

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
  }

  return { success: true };
};

// 7. GET USERS SERVICE
export const getUsersService = async (userRole, userEmail) => {
  const users = await getAllUsers(userRole);
  return users;
};

// 8. CHANGE USER ROLE SERVICE
export const changeUserRoleService = async (roleChangeData, requestingUser) => {
  const { userId, newRole, userEmail } = roleChangeData;

  const userToChange =
    (await findUserByEmail(userEmail)) || (await getAllUsers(requestingUser.role)).find((u) => u.id === userId);

  if (!userToChange) {
    console.warn(`User not found: ID=${userId}, Email=${userEmail}`);
    throw new Error("USER_NOT_FOUND");
  }

  const oldRole = userToChange.role;

  const updatedUser = await updateUserRole(userId, newRole, requestingUser.role);
  if (!updatedUser) {
    console.warn(`Failed to update role for: ${userToChange.email}`);
    throw new Error("USER_NOT_FOUND");
  }

  try {
    await sendRoleChangeEmail(
      updatedUser.email,
      updatedUser.name,
      oldRole,
      newRole,
      requestingUser.name || "Administrator"
    );
  } catch (emailError) {
    console.error("Failed to send role change email:", emailError);
  }

  return updatedUser;
};

// 9. REMOVE USER SERVICE
export const removeUserService = async (userId, requestingUserRole, requestingUserEmail) => {
  const deletedUser = await deleteUser(Number.parseInt(userId), requestingUserRole);
  if (!deletedUser) {
    console.warn(`User not found: ID=${userId}`);
    throw new Error("USER_NOT_FOUND");
  }

  return deletedUser;
};

// 10. REGISTER STUDENT SERVICE
export const registerStudentService = async (studentData, registrarUser) => {
  const { name, email, password, roles } = studentData;


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

  const verificationToken = crypto.randomBytes(32).toString("hex");

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


  const token = jwt.sign(
    { id: newUser.id, email: newUser.email, role: newUser.role },
    JWT_SECRET,
    { expiresIn: "24h" }
  );

  try {
    await sendVerificationEmail(email, name, verificationToken);
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