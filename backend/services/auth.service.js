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
  getUserById,
  updateUserRole,
  deleteUser,
  findUserByResetToken,
  linkGoogleAccount,
  setVerificationToken,
  setLanguagePreference,
} from "../models/userModel.js";
import { normalizeLanguage, LANGUAGES } from "../helper/i18n.js";
import { firebaseVerifier } from "../config/firebaseAdmin.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendRoleChangeEmail,
} from "../helper/emailService.js";
import { validatePasswordStrength, validateRoleChange, VALID_ROLES } from "../validator/user.validator.js";
import { AppError } from "../utils/AppError.js";

const BCRYPT_ROUNDS = 12;
const TOKEN_TTL = "24h";
// Compared against when the account does not exist, so timing does not reveal it.
const DUMMY_HASH = bcrypt.hashSync("gradix-dummy-password", BCRYPT_ROUNDS);

const signToken = (user) =>
  jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });

const normalizeEmail = (email) => (typeof email === "string" ? email.trim().toLowerCase() : "");

const assertStrongPassword = (password) => {
  const errors = validatePasswordStrength(password);
  if (errors.length > 0) throw new AppError("WEAK_PASSWORD", 400, errors[0]);
};

// Used when a login fails for ANY reason that could reveal whether an
// account exists (unknown email, wrong password, Google-only account).
const invalidCredentials = () => new AppError("INVALID_CREDENTIALS", 401, "Invalid email or password.");

// ==================== SERVICE FUNCTIONS ====================

// 1. SIGNUP
export const signupService = async ({ name, email, password, language }) => {
  const normalizedEmail = normalizeEmail(email);
  if (!name || !String(name).trim() || !normalizedEmail) {
    throw new AppError("MISSING_FIELDS", 400, "Name, email and password are required.");
  }
  assertStrongPassword(password);

  if (await findUserByEmail(normalizedEmail)) {
    throw new Error("USER_EXISTS");
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const newUser = await createUser(String(name).trim(), normalizedEmail, hashedPassword, "student", verificationToken, "manual", null);
  // The language chosen on the sign-up screen becomes the account's language.
  const preferred = normalizeLanguage(language);
  if (preferred !== "en") await setLanguagePreference(newUser.id, preferred);

  sendVerificationEmail({ ...newUser, language: preferred }, verificationToken);
  return { user: { ...newUser, language_preference: preferred }, emailSent: true };
};

// 2. GOOGLE AUTH
export const googleAuthService = async ({ idToken }) => {
  if (!idToken || typeof idToken !== "string") {
    throw new Error("INVALID_GOOGLE_TOKEN");
  }

  // Identity comes ONLY from the verified Firebase token, never the request body.
  let decoded;
  try {
    decoded = await firebaseVerifier.verifyIdToken(idToken);
  } catch {
    throw new Error("INVALID_GOOGLE_TOKEN");
  }

  const { uid, email: rawEmail, email_verified: emailVerified, name } = decoded || {};
  const email = normalizeEmail(rawEmail);
  if (!uid || !email || !emailVerified) {
    throw new Error("INVALID_GOOGLE_TOKEN");
  }

  let user = await findUserByEmail(email);

  if (user) {
    if (user.uid && user.uid !== uid) {
      throw new Error("GOOGLE_ACCOUNT_LINKED");
    }
    if (!user.uid || !user.verified) {
      // Google has proven ownership of this address, so link and verify.
      user = { ...user, ...(await linkGoogleAccount(user.id, uid)) };
    }
  } else {
    if (await findUserByUID(uid)) {
      throw new Error("GOOGLE_ACCOUNT_LINKED");
    }
    user = await createGoogleUser(name || email.split("@")[0], email, uid, "student");
  }

  return { user, token: signToken(user) };
};

// 3. LOGIN
export const loginService = async ({ email, password }) => {
  const user = await findUserByEmail(normalizeEmail(email));

  // Same error and (roughly) the same work whether or not the account exists.
  if (!user || !user.password || typeof password !== "string") {
    await bcrypt.compare(String(password ?? ""), DUMMY_HASH);
    throw invalidCredentials();
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw invalidCredentials();

  // Only reveal "unverified" to someone who knows the password.
  if (!user.verified && user.role !== "super_admin") {
    throw new AppError("EMAIL_NOT_VERIFIED", 403, "Please verify your email before logging in.");
  }

  return { user, token: signToken(user) };
};

// 4. VERIFY EMAIL
// Tokens are single-use and expire after 24 hours. Anything else is an error.
export const verifyEmailService = async (token) => {
  if (!token || typeof token !== "string") throw new Error("INVALID_TOKEN");

  const user = await findUserByVerificationToken(token);
  if (!user) throw new Error("INVALID_TOKEN");

  const verifiedUser = await verifyUser(token);
  if (!verifiedUser) throw new Error("INVALID_TOKEN");

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
};

// 4b. RESEND VERIFICATION (always answers the same way)
export const resendVerificationService = async (email) => {
  const user = await findUserByEmail(normalizeEmail(email));
  if (!user || user.verified || user.provider === "google") return;

  const token = crypto.randomBytes(32).toString("hex");
  await setVerificationToken(user.id, token);
  sendVerificationEmail(user, token);
};

// 5. FORGOT PASSWORD (always answers the same way)
export const forgotPasswordService = async (email) => {
  const user = await findUserByEmail(normalizeEmail(email));
  // Unknown and Google-only accounts get the same response as real ones.
  if (!user || !user.password) return;

  const resetId = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await updateResetToken(user.email, resetId, expiresAt);
  sendPasswordResetEmail(user, resetId);
};

// 6a. RESET PASSWORD (public, with emailed token)
export const resetPasswordService = async ({ resetId, newPassword }) => {
  if (!resetId || typeof resetId !== "string") throw new Error("INVALID_RESET_TOKEN");
  assertStrongPassword(newPassword);

  const user = await findUserByResetToken(resetId);
  if (!user || new Date() > new Date(user.reset_token_expires)) {
    throw new Error("INVALID_RESET_TOKEN");
  }

  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const updated = await updatePasswordById(user.id, hashedPassword);
  if (!updated) throw new Error("PASSWORD_UPDATE_FAILED");
  await updateResetToken(user.email, null, null);

  sendPasswordChangedEmail(user);
  return { success: true };
};

// 6b. CHANGE PASSWORD (authenticated, requires the current password)
export const changePasswordService = async ({ currentPassword, newPassword }, authenticatedUser) => {
  if (!authenticatedUser) throw new Error("AUTH_REQUIRED");
  if (!currentPassword) throw new AppError("CURRENT_PASSWORD_REQUIRED", 400, "Current password is required.");
  assertStrongPassword(newPassword);

  const user = await findUserByEmail(authenticatedUser.email);
  if (!user) throw new Error("USER_NOT_FOUND");
  if (!user.password) {
    throw new AppError("NO_PASSWORD", 400, "This account signs in with Google and has no password to change.");
  }

  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) throw new Error("INVALID_CURRENT_PASSWORD");
  if (await bcrypt.compare(newPassword, user.password)) {
    throw new AppError("SAME_PASSWORD", 400, "The new password must be different from the current one.");
  }

  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const updated = await updatePasswordById(user.id, hashedPassword);
  if (!updated) throw new Error("PASSWORD_UPDATE_FAILED");

  sendPasswordChangedEmail(user);
  return { success: true };
};

// 7. GET USERS
export const getUsersService = async (userRole) => getAllUsers(userRole);

// 8. CHANGE USER ROLE
// The check uses the TARGET's current role from the database.
export const changeUserRoleService = async ({ userId, newRole }, requestingUser) => {
  const targetId = Number.parseInt(userId, 10);
  if (!Number.isInteger(targetId)) throw new AppError("INVALID_USER_ID", 400, "Invalid user ID.");
  if (!VALID_ROLES.includes(newRole)) throw new AppError("INVALID_ROLE", 400, "Invalid role.");
  if (targetId === requestingUser.id) {
    throw new AppError("CANNOT_CHANGE_OWN_ROLE", 400, "You cannot change your own role.");
  }

  const target = await getUserById(targetId);
  if (!target) throw new Error("USER_NOT_FOUND");

  const errors = validateRoleChange(requestingUser.role, target.role, newRole);
  if (errors.length > 0) throw new AppError("ROLE_CHANGE_FORBIDDEN", 403, errors[0]);

  if (target.role === newRole) return target;

  const updatedUser = await updateUserRole(targetId, newRole, requestingUser.role, target.role);
  if (!updatedUser) throw new Error("USER_NOT_FOUND");

  sendRoleChangeEmail({ ...updatedUser, language: target.language_preference }, target.role, newRole);
  return updatedUser;
};

// 9. REMOVE USER (super_admin only, enforced by route and model)
export const removeUserService = async (userId, requestingUser) => {
  const targetId = Number.parseInt(userId, 10);
  if (!Number.isInteger(targetId)) throw new AppError("INVALID_USER_ID", 400, "Invalid user ID.");
  if (targetId === requestingUser.id) {
    throw new AppError("CANNOT_DELETE_SELF", 400, "You cannot delete your own account.");
  }

  const deletedUser = await deleteUser(targetId, requestingUser.role);
  if (!deletedUser) throw new Error("USER_NOT_FOUND");
  return deletedUser;
};

// 10. REGISTER STUDENT (by admin / instructor / super_admin)
export const registerStudentService = async ({ name, email, password, roles, language }, registrarUser) => {
  if (roles !== undefined) throw new Error("INVALID_ROLES_FIELD");
  if (!["admin", "instructor", "super_admin"].includes(registrarUser.role)) throw new Error("UNAUTHORIZED_ROLE");

  const normalizedEmail = normalizeEmail(email);
  if (!name || !normalizedEmail || !password) throw new Error("MISSING_FIELDS");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error("INVALID_EMAIL");
  assertStrongPassword(password);

  if (await findUserByEmail(normalizedEmail)) throw new Error("USER_EXISTS");

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const newUser = await createUser(String(name).trim(), normalizedEmail, hashedPassword, "student", verificationToken, "manual", null);

  // The registrar picks the student's language (defaults to English).
  const preferred = normalizeLanguage(language);
  if (preferred !== "en") await setLanguagePreference(newUser.id, preferred);
  sendVerificationEmail({ ...newUser, language: preferred }, verificationToken);
  // No token is returned: the registrar must not receive a session for the new student.
  return { user: newUser, emailSent: true };
};

// 11. LANGUAGE PREFERENCE (own account)
export const setLanguagePreferenceService = async (language, authenticatedUser) => {
  if (!LANGUAGES.includes(language)) throw new AppError("UNSUPPORTED_LANGUAGE", 400, "Unsupported language.");
  const updated = await setLanguagePreference(authenticatedUser.id, language);
  if (!updated) throw new Error("USER_NOT_FOUND");
  return { language: updated.language_preference };
};

// ==================== HELPERS ====================

export const formatUserResponse = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  verified: user.verified,
  provider: user.provider,
  language: user.language_preference || "en",
});
