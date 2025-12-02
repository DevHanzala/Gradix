import { useState, useEffect } from "react";
import useAuthStore from "../../store/authStore.js";
import { Card, CardHeader, CardContent } from "../../components/ui/Card.jsx";
import LoadingSpinner from "../../components/ui/LoadingSpinner.jsx";
import Modal from "../../components/ui/Modal.jsx";
import Navbar from "../../components/Navbar.jsx";
import Footer from "../../components/Footer.jsx";
import { FaUser, FaChartBar, FaUsers, FaCheckCircle, FaClock } from "react-icons/fa";

function AdminDashboard() {
  const { user, getUsers, changeUserRole } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ isOpen: false, type: "info", title: "", message: "" });
  const [roleChangeLoading, setRoleChangeLoading] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await getUsers();
      setUsers(response.users);
    } catch (error) {
      showModal("error", "Error", "Failed to fetch users. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const showModal = (type, title, message) => {
    setModal({ isOpen: true, type, title, message });
  };

  const handleRoleChange = async (userId, newRole, userName) => {
    try {
      setRoleChangeLoading(userId);
      await changeUserRole({ userId, newRole });
      await fetchUsers();
      showModal("success", "Success", `Successfully changed ${userName}'s role to ${newRole}.`);
    } catch (error) {
      showModal("error", "Error", error.response?.data?.message || "Failed to change role.");
    } finally {
      setRoleChangeLoading(null);
    }
  };

  const getUserStats = () => {
    return users.reduce(
      (acc, u) => {
        acc[u.role] = (acc[u.role] || 0) + 1;
        u.verified ? acc.verified++ : acc.unverified++;
        return acc;
      },
      { admin: 0, instructor: 0, student: 0, verified: 0, unverified: 0 }
    );
  };

  const stats = getUserStats();

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case "admin": return "bg-red-100 text-red-800";
      case "instructor": return "bg-blue-100 text-blue-800";
      case "student": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Navbar />

      <div className="w-full mx-auto px-4 sm:px-4 lg:px-8 xl:px-10 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user?.name}! Manage your platform from here.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card className="shadow-lg bg-white rounded-xl">
            <CardContent className="text-center py-6">
              <div className="text-3xl font-bold text-blue-600 flex items-center justify-center">
                <FaUsers className="mr-2" /> {users.length}
              </div>
              <div className="text-gray-600">Total Users</div>
            </CardContent>
          </Card>
          <Card className="shadow-lg bg-white rounded-xl">
            <CardContent className="text-center py-6">
              <div className="text-3xl font-bold text-red-600 flex items-center justify-center">
                <FaUser className="mr-2" /> {stats.admin}
              </div>
              <div className="text-gray-600">Admins</div>
            </CardContent>
          </Card>
          <Card className="shadow-lg bg-white rounded-xl">
            <CardContent className="text-center py-6">
              <div className="text-3xl font-bold text-blue-600 flex items-center justify-center">
                <FaUser className="mr-2" /> {stats.instructor}
              </div>
              <div className="text-gray-600">Instructors</div>
            </CardContent>
          </Card>
          <Card className="shadow-lg bg-white rounded-xl">
            <CardContent className="text-center py-6">
              <div className="text-3xl font-bold text-green-600 flex items-center justify-center">
                <FaUser className="mr-2" /> {stats.student}
              </div>
              <div className="text-gray-600">Students</div>
            </CardContent>
          </Card>
          <Card className="shadow-lg bg-white rounded-xl">
            <CardContent className="text-center py-6">
              <div className="text-3xl font-bold text-green-600 flex items-center justify-center">
                <FaCheckCircle className="mr-2" /> {stats.verified}
              </div>
              <div className="text-gray-600">Verified</div>
            </CardContent>
          </Card>
        </div>

        {/* Users List Card */}
        <Card className="shadow-lg bg-white rounded-xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold flex items-center">
                <FaUsers className="mr-2" /> All Users
              </h2>
              <button
                onClick={fetchUsers}
                className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition"
              >
                Refresh
              </button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-12">
                <LoadingSpinner size="lg" />
                <p className="text-gray-600 mt-4">Loading users...</p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="overflow-x-auto hidden lg:block">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((userData) => (
                        <tr key={userData.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">{userData.name}</div>
                            <div className="text-sm text-gray-500">{userData.email}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(userData.role)}`}>
                              {userData.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-3 py-1 text-xs rounded-full ${userData.verified ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                              {userData.verified ? "Verified" : "Pending"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {new Date(userData.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            {userData.id !== user?.id && (
                              <div className="flex flex-wrap gap-2">
                                {userData.role !== "admin" && (
                                  <button
                                    onClick={() => handleRoleChange(userData.id, "admin", userData.name)}
                                    disabled={roleChangeLoading === userData.id}
                                    className="text-red-600 hover:text-red-900 text-sm font-medium"
                                  >
                                    {roleChangeLoading === userData.id ? "..." : "Make Admin"}
                                  </button>
                                )}
                                {userData.role !== "instructor" && (
                                  <button
                                    onClick={() => handleRoleChange(userData.id, "instructor", userData.name)}
                                    disabled={roleChangeLoading === userData.id}
                                    className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                                  >
                                    {roleChangeLoading === userData.id ? "..." : "Make Instructor"}
                                  </button>
                                )}
                                {userData.role !== "student" && (
                                  <button
                                    onClick={() => handleRoleChange(userData.id, "student", userData.name)}
                                    disabled={roleChangeLoading === userData.id}
                                    className="text-green-600 hover:text-green-900 text-sm font-medium"
                                  >
                                    {roleChangeLoading === userData.id ? "..." : "Make Student"}
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden">
                  {users.map((userData) => (
                    <div key={userData.id} className="border-b border-gray-200 p-5 hover:bg-gray-50">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{userData.name}</h3>
                          <p className="text-sm text-gray-500">{userData.email}</p>
                        </div>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(userData.role)}`}>
                          {userData.role}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                        <div>
                          <span className="text-gray-500">Status:</span>
                          <span className={`ml-2 px-2 py-1 rounded-full text-xs ${userData.verified ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                            {userData.verified ? "Verified" : "Pending"}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Joined:</span>
                          <span className="ml-2 text-gray-700">
                            {new Date(userData.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {userData.id !== user?.id && (
                        <div className="flex flex-wrap gap-3">
                          {userData.role !== "admin" && (
                            <button
                              onClick={() => handleRoleChange(userData.id, "admin", userData.name)}
                              disabled={roleChangeLoading === userData.id}
                              className="text-red-600 hover:text-red-900 font-medium text-sm"
                            >
                              {roleChangeLoading === userData.id ? "..." : "Make Admin"}
                            </button>
                          )}
                          {userData.role !== "instructor" && (
                            <button
                              onClick={() => handleRoleChange(userData.id, "instructor", userData.name)}
                              disabled={roleChangeLoading === userData.id}
                              className="text-blue-600 hover:text-blue-900 font-medium text-sm"
                            >
                              {roleChangeLoading === userData.id ? "..." : "Make Instructor"}
                            </button>
                          )}
                          {userData.role !== "student" && (
                            <button
                              onClick={() => handleRoleChange(userData.id, "student", userData.name)}
                              disabled={roleChangeLoading === userData.id}
                              className="text-green-600 hover:text-green-900 font-medium text-sm"
                            >
                              {roleChangeLoading === userData.id ? "..." : "Make Student"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Footer />

      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        type={modal.type}
        title={modal.title}
      >
        {modal.message}
      </Modal>
    </div>
  );
}

export default AdminDashboard;