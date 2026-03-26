import * as userRepo from "../repositories/userRepository.js";
import {
  VALID_ROLES,
  validateUserData,
  validateRoleChange,
  validateUserDeletion,
  validatePasswordUpdate,
  validateResetTokenUpdate,
  validateSearchTerm,
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
      throw new Error("User with this email already exists");
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
      throw new Error("User with this email already exists");
    }
    console.error("❌ Error creating Google user:", error.message, error.stack);
    throw error;
  }
};

// ==================== USER LOOKUP ====================

export const findUserByEmail = async (email) => {
  try {
    const user = await userRepo.findUserByEmailQuery(email);
    return user;
  } catch (error) {
    console.error("❌ Error finding user by email:", error.message);
    throw new Error("Database error during user lookup");
  }
};

export const getUserByEmail = async (email) => {
  try {
    const user = await userRepo.findUserByEmailQuery(email);
    return user;
  } catch (error) {
    console.error("❌ Error getting user by email:", error.message);
    throw new Error("Database error during user lookup");
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
    throw new Error("Database error during UID lookup");
  }
};

export const findUserByVerificationToken = async (token) => {
  try {
    const user = await userRepo.findUserByVerificationTokenQuery(token);
    return user;
  } catch (error) {
    console.error("❌ Error finding user by verification token:", error.message);
    throw new Error("Database error during verification token lookup");
  }
};

export const findUserByResetToken = async (resetId) => {
  try {
    const user = await userRepo.findUserByResetTokenQuery(resetId);
    return user;
  } catch (error) {
    console.error("❌ Error finding user by reset token:", error.message);
    throw new Error("Database error during reset token lookup");
  }
};

export const userExistsByEmail = async (email) => {
  try {
    const exists = await userRepo.checkUserExistsByEmailQuery(email);
    return exists;
  } catch (error) {
    console.error("❌ Error checking user existence:", error.message);
    throw error;
  }
};

// ==================== USER VERIFICATION & PASSWORD ====================

export const verifyUser = async (token) => {
  try {
    const user = await userRepo.verifyUserQuery(token);
    return user;
  } catch (error) {
    console.error("❌ Error verifying user:", error.message);
    throw new Error("Database error during user verification");
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
    throw new Error("Database error during reset token update");
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
    throw new Error("Database error during password update");
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

export const updateUserRole = async (userId, newRole, requestingUserRole) => {
  try {
    const validationErrors = validateRoleChange(requestingUserRole, newRole);
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

export const getRecentlyVerifiedUsers = async () => {
  try {
    const users = await userRepo.findRecentlyVerifiedUsersQuery();
    return users;
  } catch (error) {
    console.error("❌ Error getting recently verified users:", error.message);
    throw error;
  }
};

// ==================== USER SEARCH & FILTERING ====================

export const getUsersByRole = async (role) => {
  try {
    if (Array.isArray(role)) {
      throw new Error('Role must be a string, not an array');
    }
    if (!VALID_ROLES.includes(role)) {
      throw new Error(`Invalid role: ${role}. Must be one of ${VALID_ROLES.join(', ')}`);
    }
    const users = await userRepo.findUsersByRoleQuery(role);
    return users;
  } catch (error) {
    console.error("❌ Error getting users by role:", error.message);
    throw error;
  }
};

export const searchUsers = async (searchTerm) => {
  try {
    const validationErrors = validateSearchTerm(searchTerm);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }
    const users = await userRepo.searchUsersQuery(searchTerm);
    return users;
  } catch (error) {
    console.error("❌ Error searching users:", error.message);
    throw error;
  }
};

// ==================== USER STATISTICS ====================

export const getUserStats = async () => {
  try {
    const stats = await userRepo.getUserStatsQuery();
    return stats;
  } catch (error) {
    console.error("❌ Error getting user stats:", error.message);
    throw error;
  }
};