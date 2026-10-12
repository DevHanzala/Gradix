import UserManagement from "../../components/UserManagement.jsx";

function AdminDashboard() {
  return (
    <UserManagement
      title="Admin dashboard"
      subtitle="Manage students and instructors. Admin and Super Admin accounts can only be changed by a Super Admin."
    />
  );
}

export default AdminDashboard;
