import * as userRepo from "../repositories/userRepository.js";
import {
  validateUserData,
  validateRoleChange,
  validateUserDeletion,
  validatePasswordUpdate,
  validateResetTokenUpdate,
} from "../validator/user.validator.js";

// ==================== USER CREATION ====================

export const createUser = async (name, email, hashedPassword, role, verificationToken, provider, uid) => {
  try {
    const validationErrors = validateUserData({ name, email, role, provider });
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }


    const user = await userRepo.createUserQuery({ name, email, hashedPassword, role, verificationToken, provider, uid });
    return user;
  } catch (error) {
    if (error.code === "23505") {
      console.warn(`⚠️ Duplicate email: ${email}`);
      throw new Error("User with this email already exists", { cause: error });
    }
    console.error("❌ Error creating user:", error.message, error.stack);
    throw error;
  }
};

export const createGoogleUser = async (name, email, uid, role) => {
  try {
    const validationErrors = validateUserData({ name, email, role, provider: 'google' });
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }
    const user = await userRepo.createGoogleUserQuery({ name, email, role, uid });
    return user;
  } catch (error) {
    if (error.code === "23505") {
      console.warn(`⚠️ Duplicate email: ${email}`);
      throw new Error("User with this email already exists", { cause: error });
    }
    console.error("❌ Error creating Google user:", error.message, error.stack);
    throw error;
  }
};

export const linkGoogleAccount = async (userId, uid) => userRepo.linkGoogleAccountQuery(userId, uid);

// ==================== USER LOOKUP ====================

export const findUserByEmail = async (email) => {
  try {
    const user = await userRepo.findUserByEmailQuery(email);
    return user;
  } catch (error) {
    console.error("❌ Error finding user by email:", error.message);
    throw new Error("Database error during user lookup", { cause: error });
  }
};

export const getUserById = async (id) => {
  try {
    const user = await userRepo.findUserByIdQuery(id);
    return user;
  } catch (error) {
    console.error("❌ Error getting user by ID:", error.message);
    throw error;
  }
};

export const findUserByUID = async (uid) => {
  try {
    const user = await userRepo.findUserByUIDQuery(uid);
    return user;
  } catch (error) {
    console.error("❌ Error finding user by UID:", error.message);
    throw new Error("Database error during UID lookup", { cause: error });
  }
};

export const findUserByVerificationToken = async (token) => {
  try {
    const user = await userRepo.findUserByVerificationTokenQuery(token);
    return user;
  } catch (error) {
    console.error("❌ Error finding user by verification token:", error.message);
    throw new Error("Database error during verification token lookup", { cause: error });
  }
};

export const findUserByResetToken = async (resetId) => {
  try {
    const user = await userRepo.findUserByResetTokenQuery(resetId);
    return user;
  } catch (error) {
    console.error("❌ Error finding user by reset token:", error.message);
    throw new Error("Database error during reset token lookup", { cause: error });
  }
};

// ==================== USER VERIFICATION & PASSWORD ====================

export const verifyUser = async (token) => {
  try {
    const user = await userRepo.verifyUserQuery(token);
    return user;
  } catch (error) {
    console.error("❌ Error verifying user:", error.message);
    throw new Error("Database error during user verification", { cause: error });
  }
};

export const updateResetToken = async (email, resetId, expiresAt) => {
  try {
    const validationErrors = validateResetTokenUpdate({ email });
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    const user = await userRepo.updateResetTokenQuery(email, resetId, expiresAt);
    return user;
  } catch (error) {
    console.error("❌ Error updating reset token:", error.message);
    throw new Error("Database error during reset token update", { cause: error });
  }
};

export const updatePasswordById = async (userId, hashedPassword) => {
  try {
    const validationErrors = validatePasswordUpdate({ userId, hashedPassword });
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    const user = await userRepo.updatePasswordByIdQuery(userId, hashedPassword);
    return user;
  } catch (error) {
    console.error("❌ Error updating password by ID:", error.message);
    throw new Error("Database error during password update", { cause: error });
  }
};

// ==================== USER MANAGEMENT ====================

export const getAllUsers = async (requestingUserRole) => {
  try {
    
    if (!["admin", "super_admin"].includes(requestingUserRole)) {
      console.warn(`⚠️ Insufficient permissions: ${requestingUserRole}`);
      throw new Error("Insufficient permissions to view all users");
    }

    const users = await userRepo.findAllUsersQuery();
    return users;
  } catch (error) {
    console.error("❌ Error getting all users:", error.message);
    throw error;
  }
};

export const updateUserRole = async (userId, newRole, requestingUserRole, targetCurrentRole) => {
  try {
    const validationErrors = validateRoleChange(requestingUserRole, targetCurrentRole, newRole);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    const user = await userRepo.updateUserRoleQuery(userId, newRole);
    return user;
  } catch (error) {
    console.error("❌ Error updating user role:", error.message);
    throw error;
  }
};

export const deleteUser = async (userId, requestingUserRole) => {
  try {
    const validationErrors = validateUserDeletion(requestingUserRole);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    const user = await userRepo.deleteUserQuery(userId);
    return user;
  } catch (error) {
    console.error("❌ Error deleting user:", error.message);
    throw error;
  }
};

// ==================== USER SEARCH & FILTERING ====================

// ==================== USER STATISTICS ====================

export const setVerificationToken = async (userId, token) => userRepo.setVerificationTokenQuery(userId, token);

export const setLanguagePreference = async (userId, language) => userRepo.setLanguagePreferenceQuery(userId, language);
