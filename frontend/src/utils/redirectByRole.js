export const redirectByRole = (role, navigate) => {
  switch (role) {
    case "super_admin":
      navigate("/super-admin/dashboard");
      break;
    case "admin":
      navigate("/admin/dashboard");
      break;
    case "instructor":
      navigate("/instructor/dashboard");
      break;
    case "student":
      navigate("/student/dashboard");
      break;
    default:
      navigate("/profile");
  }
};
