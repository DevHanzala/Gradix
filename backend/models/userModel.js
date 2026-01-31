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

    console.log(`🔍 Creating user with params:`, { name, email, role, provider, uid });

    const user = await userRepo.createUserQuery({ name, email, hashedPassword, role, verificationToken, provider, uid });
    console.log(`✅ User created:`, user);
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

    console.log(`🔍 Creating Google user with params:`, { name, email, role, uid });

    const user = await userRepo.createGoogleUserQuery({ name, email, role, uid });
    console.log(`✅ Google user created:`, user);
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
    console.log(`🔍 Finding user by email: ${email}`);
    const user = await userRepo.findUserByEmailQuery(email);
    console.log(`✅ Found user:`, user || "null");
    return user;
  } catch (error) {
    console.error("❌ Error finding user by email:", error.message);
    throw new Error("Database error during user lookup");
  }
};

export const getUserByEmail = async (email) => {
  try {
    console.log(`🔍 Getting user by email: ${email}`);
    const user = await userRepo.findUserByEmailQuery(email);
    console.log(`✅ Got user:`, user || "null");
    return user;
  } catch (error) {
    console.error("❌ Error getting user by email:", error.message);
    throw new Error("Database error during user lookup");
  }
};

export const getUserById = async (id) => {
  try {
    console.log(`🔍 Getting user by ID: ${id}`);
    const user = await userRepo.findUserByIdQuery(id);
    console.log(`✅ Found user by ID:`, user || "null");
    return user;
  } catch (error) {
    console.error("❌ Error getting user by ID:", error.message);
    throw error;
  }
};

export const findUserByUID = async (uid) => {
  try {
    console.log(`🔍 Finding user by UID: ${uid}`);
    const user = await userRepo.findUserByUIDQuery(uid);
    console.log(`✅ Found user by UID:`, user || "null");
    return user;
  } catch (error) {
    console.error("❌ Error finding user by UID:", error.message);
    throw new Error("Database error during UID lookup");
  }
};

export const findUserByVerificationToken = async (token) => {
  try {
    console.log(`🔍 Finding user by verification token: ${token.slice(0, 10)}...`);
    const user = await userRepo.findUserByVerificationTokenQuery(token);
    console.log(`✅ Found user by verification token:`, user || "null");
    return user;
  } catch (error) {
    console.error("❌ Error finding user by verification token:", error.message);
    throw new Error("Database error during verification token lookup");
  }
};

export const findUserByResetToken = async (resetId) => {
  try {
    console.log(`🔍 Finding user by reset token: ${resetId.slice(0, 10)}...`);
    const user = await userRepo.findUserByResetTokenQuery(resetId);
    console.log(`✅ Found user by reset token:`, user || "null");
    return user;
  } catch (error) {
    console.error("❌ Error finding user by reset token:", error.message);
    throw new Error("Database error during reset token lookup");
  }
};

export const userExistsByEmail = async (email) => {
  try {
    console.log(`🔍 Checking if user exists by email: ${email}`);
    const exists = await userRepo.checkUserExistsByEmailQuery(email);
    console.log(`✅ User exists: ${exists}`);
    return exists;
  } catch (error) {
    console.error("❌ Error checking user existence:", error.message);
    throw error;
  }
};

// ==================== USER VERIFICATION & PASSWORD ====================

export const verifyUser = async (token) => {
  try {
    console.log(`🔍 Verifying user with token: ${token.slice(0, 10)}...`);
    const user = await userRepo.verifyUserQuery(token);
    console.log(`✅ User verified:`, user || "null");
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

    console.log(`🔍 Updating reset token for: ${email}`);
    const user = await userRepo.updateResetTokenQuery(email, resetId, expiresAt);
    console.log(`✅ Reset token updated:`, user || "null");
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

    console.log(`🔍 Updating password for user ID: ${userId}`);
    const user = await userRepo.updatePasswordByIdQuery(userId, hashedPassword);
    console.log(`✅ Password updated:`, user || "null");
    return user;
  } catch (error) {
    console.error("❌ Error updating password by ID:", error.message);
    throw new Error("Database error during password update");
  }
};

// ==================== USER MANAGEMENT ====================

export const getAllUsers = async (requestingUserRole) => {
  try {
    console.log(`🔍 Getting all users for role: ${requestingUserRole}`);
    
    if (!["admin", "super_admin"].includes(requestingUserRole)) {
      console.warn(`⚠️ Insufficient permissions: ${requestingUserRole}`);
      throw new Error("Insufficient permissions to view all users");
    }

    const users = await userRepo.findAllUsersQuery();
    console.log(`✅ Fetched ${users.length} users`);
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

    console.log(`🔍 Updating role for user ID: ${userId} to ${newRole} by ${requestingUserRole}`);

    const user = await userRepo.updateUserRoleQuery(userId, newRole);
    console.log(`✅ Role updated:`, user || "null");
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

    console.log(`🔍 Deleting user ID: ${userId} by ${requestingUserRole}`);

    const user = await userRepo.deleteUserQuery(userId);
    console.log(`✅ User deleted:`, user || "null");
    return user;
  } catch (error) {
    console.error("❌ Error deleting user:", error.message);
    throw error;
  }
};

export const getRecentlyVerifiedUsers = async () => {
  try {
    console.log(`🔍 Getting recently verified users`);
    const users = await userRepo.findRecentlyVerifiedUsersQuery();
    console.log(`✅ Fetched ${users.length} recently verified users`);
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

    console.log(`🔍 Getting users by role: ${role}`);
    const users = await userRepo.findUsersByRoleQuery(role);
    console.log(`✅ Fetched ${users.length} users with role ${role}`);
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

    console.log(`🔍 Searching users with term: ${searchTerm}`);
    const users = await userRepo.searchUsersQuery(searchTerm);
    console.log(`✅ Found ${users.length} users matching ${searchTerm}`);
    return users;
  } catch (error) {
    console.error("❌ Error searching users:", error.message);
    throw error;
  }
};

// ==================== USER STATISTICS ====================

export const getUserStats = async () => {
  try {
    console.log(`🔍 Getting user stats`);
    const stats = await userRepo.getUserStatsQuery();
    console.log(`✅ User stats retrieved:`, stats);
    return stats;
  } catch (error) {
    console.error("❌ Error getting user stats:", error.message);
    throw error;
  }
};