const DASHBOARDS = {
  super_admin: "/super-admin/dashboard",
  admin: "/admin/dashboard",
  instructor: "/instructor/dashboard",
  student: "/student/dashboard",
};

// Each role's own part of the app; paths outside every area (e.g. /profile) are open to all.
const ROLE_AREAS = {
  super_admin: "/super-admin/",
  admin: "/admin/",
  instructor: "/instructor/",
  student: "/student/",
};

export const dashboardPathForRole = (role) => DASHBOARDS[role] || "/";

/** Whether a user with this role may open the path (used before returning to a remembered page). */
export const canOpenPath = (path, role) => {
  const area = Object.values(ROLE_AREAS).find((prefix) => path.startsWith(prefix));
  return !area || area === ROLE_AREAS[role];
};

export const redirectByRole = (role, navigate) => {
  navigate(DASHBOARDS[role] || "/profile");
};
