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

export const validateRoleChange = (requestingUserRole, targetRole) => {
  const errors = [];

  if (!VALID_ROLES.includes(requestingUserRole)) {
    errors.push('Requesting user has invalid role');
  }

  if (Array.isArray(targetRole)) {
    errors.push('Target role must be a string, not an array');
  } else if (!VALID_ROLES.includes(targetRole)) {
    errors.push(`Target role must be one of: ${VALID_ROLES.join(', ')}`);
  }

  if (!['admin', 'super_admin'].includes(requestingUserRole)) {
    errors.push('Insufficient permissions to change user roles');
  }

  if (requestingUserRole === 'admin' && ['admin', 'super_admin'].includes(targetRole)) {
    errors.push('Admin users cannot promote users to admin or super admin roles');
  }

  return errors;
};

export const validateUserDeletion = (requestingUserRole) => {
  const errors = [];

  if (requestingUserRole !== 'super_admin') {
    errors.push('Only super admins can delete users');
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

export const validateSearchTerm = (searchTerm) => {
  const errors = [];

  if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim().length < 2) {
    errors.push('Search term must be at least 2 characters');
  }

  return errors;
};

// ==================== HELPER FUNCTIONS ====================

const isValidEmail = (email) => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
};

