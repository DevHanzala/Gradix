const DASHBOARDS = {
  super_admin: "/super-admin/dashboard",
  admin: "/admin/dashboard",
  instructor: "/instructor/dashboard",
  student: "/student/dashboard",
};

export const dashboardPathForRole = (role) => DASHBOARDS[role] || "/";

export const redirectByRole = (role, navigate) => {
  navigate(DASHBOARDS[role] || "/profile");
};
