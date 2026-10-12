// Mirrors backend/validator/user.validator.js validateRoleChange.
// The backend is authoritative; this only decides which controls to show.

export const ROLE_LABELS = {
  student: "Student",
  instructor: "Instructor",
  admin: "Admin",
  super_admin: "Super Admin",
};

const ALL_ROLES = ["student", "instructor", "admin", "super_admin"];
const PRIVILEGED = ["admin", "super_admin"];

/** Roles `requester` may assign to `target` (empty array = no role controls). */
export const assignableRoles = (requester, target) => {
  if (!requester || !target || requester.id === target.id) return [];

  if (requester.role === "super_admin") {
    return ALL_ROLES.filter((r) => r !== target.role);
  }

  if (requester.role === "admin") {
    if (PRIVILEGED.includes(target.role)) return [];
    return ["student", "instructor"].filter((r) => r !== target.role);
  }

  return [];
};

/** Only super admins may delete accounts, and never their own. */
export const canDeleteUser = (requester, target) =>
  requester?.role === "super_admin" && target && requester.id !== target.id;
