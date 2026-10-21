export const VALID_ROLES = ["student", "instructor", "admin", "super_admin"];
export const VALID_PROVIDERS = ["manual", "google"];

export const validateUserData = (data) => {
  const errors = [];

  if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
    errors.push('Name is required and must be a non-empty string');
  }

  if (!data.email || typeof data.email !== 'string' || !isValidEmail(data.email)) {
    errors.push('Valid email is required');
  }

  if (data.role) {
    if (Array.isArray(data.role)) {
      errors.push('Role must be a string, not an array');
    } else if (typeof data.role !== 'string' || !VALID_ROLES.includes(data.role)) {
      errors.push(`Role must be one of: ${VALID_ROLES.join(', ')}`);
    }
  }

  if (data.provider && !VALID_PROVIDERS.includes(data.provider)) {
    errors.push(`Provider must be one of: ${VALID_PROVIDERS.join(', ')}`);
  }

  return errors;
};

const PRIVILEGED_ROLES = ["admin", "super_admin"];

/**
 * Who may change whose role:
 * - super_admin: any role for any other user.
 * - admin: only students and instructors, and only to student or instructor.
 * - nobody else.
 * `targetCurrentRole` is the target user's role as stored in the DB.
 */
export const validateRoleChange = (requestingUserRole, targetCurrentRole, newRole) => {
  const errors = [];

  if (Array.isArray(newRole) || !VALID_ROLES.includes(newRole)) {
    errors.push(`Target role must be one of: ${VALID_ROLES.join(", ")}`);
  }

  if (requestingUserRole === "super_admin") return errors;

  if (requestingUserRole !== "admin") {
    errors.push("Insufficient permissions to change user roles");
    return errors;
  }

  if (PRIVILEGED_ROLES.includes(targetCurrentRole)) {
    errors.push("Admins cannot change the role of an admin or super admin");
  }
  if (PRIVILEGED_ROLES.includes(newRole)) {
    errors.push("Admins cannot grant the admin or super admin role");
  }

  return errors;
};


export const validatePasswordUpdate = (data) => {
  const errors = [];

  if (!data.userId || !Number.isInteger(data.userId)) {
    errors.push('User ID must be a valid integer');
  }

  if (!data.hashedPassword || typeof data.hashedPassword !== 'string') {
    errors.push('Hashed password is required');
  }

  return errors;
};

export const validateResetTokenUpdate = (data) => {
  const errors = [];

  if (!data.email || typeof data.email !== 'string' || !isValidEmail(data.email)) {
    errors.push('Valid email is required');
  }

  return errors;
};

/** Same rule as the frontend: 8+ chars with upper, lower and a digit. */
export const validatePasswordStrength = (password) => {
  const errors = [];
  if (typeof password !== "string" || password.length < 8) {
    errors.push("Password must be at least 8 characters");
  } else if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    errors.push("Password must contain an uppercase letter, a lowercase letter and a number");
  }
  if (typeof password === "string" && password.length > 128) {
    errors.push("Password must be at most 128 characters");
  }
  return errors;
};

// ==================== HELPER FUNCTIONS ====================

const isValidEmail = (email) => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
};

