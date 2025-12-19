import { useState, useEffect } from "react";
import useAuthStore from "../../store/authStore.js";
import { Card, CardHeader, CardContent } from "../../components/ui/Card.jsx";
import LoadingSpinner from "../../components/ui/LoadingSpinner.jsx";
import Modal from "../../components/ui/Modal.jsx";
import Navbar from "../../components/Navbar.jsx";
import Footer from "../../components/Footer.jsx";
import { 
  FaUser, 
  FaChartBar, 
  FaUsers, 
  FaCheckCircle, 
  FaClock,
  FaUserShield,
  FaChalkboardTeacher,
  FaUserGraduate,
  FaSync,
  FaCrown,
  FaCalendarAlt
} from "react-icons/fa";

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
      case "admin": return "bg-red-100 text-red-800 border-red-200";
      case "instructor": return "bg-blue-100 text-blue-800 border-blue-200";
      case "student": return "bg-green-100 text-green-800 border-green-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const statsData = [
    {
      value: users.length,
      label: "Total Users",
      icon: <FaUsers className="w-6 h-6 sm:w-7 sm:h-7" />,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
    },
    {
      value: stats.admin,
      label: "Admins",
      icon: <FaUserShield className="w-6 h-6 sm:w-7 sm:h-7" />,
      color: "text-red-600",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
    },
    {
      value: stats.instructor,
      label: "Instructors",
      icon: <FaChalkboardTeacher className="w-6 h-6 sm:w-7 sm:h-7" />,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
    },
    {
      value: stats.student,
      label: "Students",
      icon: <FaUserGraduate className="w-6 h-6 sm:w-7 sm:h-7" />,
      color: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
    },
    {
      value: stats.verified,
      label: "Verified",
      icon: <FaCheckCircle className="w-6 h-6 sm:w-7 sm:h-7" />,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
      <Navbar />

      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        {/* Welcome Section - Enhanced */}
        <div className="mb-8 sm:mb-10">
          <div className="bg-gradient-to-r from-red-600 to-purple-600 rounded-2xl sm:rounded-3xl p-6 sm:p-8 lg:p-10 shadow-2xl text-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 sm:mb-3 flex items-center gap-3">
                  <FaCrown className="text-yellow-300" />
                  Admin Dashboard
                </h1>
                <p className="text-red-100 text-sm sm:text-base lg:text-lg">
                  Welcome back, {user?.name}! Manage your platform and oversee all operations.
                </p>
              </div>
              <div className="hidden sm:block">
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 lg:p-6">
                  <FaUsers className="w-10 h-10 lg:w-12 lg:h-12 mx-auto mb-2" />
                  <p className="text-xs lg:text-sm font-semibold text-center">
                    {users.length} Total Users
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards - Enhanced */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6 mb-8 sm:mb-10">
          {statsData.map((stat, index) => (
            <Card 
              key={index} 
              className={`border-2 ${stat.borderColor} hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1`}
            >
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col items-center text-center">
                  <div className={`${stat.bgColor} ${stat.color} p-3 sm:p-4 rounded-2xl mb-3 sm:mb-4`}>
                    {stat.icon}
                  </div>
                  <div className={`text-2xl sm:text-3xl lg:text-4xl font-bold ${stat.color} mb-1 sm:mb-2`}>
                    {stat.value}
                  </div>
                  <div className="text-gray-600 text-xs sm:text-sm font-medium">{stat.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Users List Card - Enhanced */}
        <Card className="shadow-2xl border-2 border-gray-200 rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 text-white border-b-2 border-blue-700">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold flex items-center gap-2">
                <FaUsers className="text-xl sm:text-2xl" />
                All Users Management
              </h2>
              <button
                onClick={fetchUsers}
                className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl transition-all duration-300 font-semibold text-sm sm:text-base shadow-lg hover:shadow-xl"
              >
                <FaSync className="animate-spin-on-hover" />
                Refresh
              </button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-16 sm:py-20">
                <LoadingSpinner size="lg" type="bars" color="purple" />
                <p className="text-gray-600 mt-4 text-sm sm:text-base">Loading users...</p>
              </div>
            ) : (
              <>
                {/* Desktop Table - Enhanced */}
                <div className="overflow-x-auto hidden lg:block">
                  <table className="min-w-full divide-y-2 divide-gray-200">
                    <thead className="bg-gradient-to-r from-gray-100 to-blue-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wider">
                          <div className="flex items-center gap-2">
                            <FaUser />
                            User
                          </div>
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wider">
                          <div className="flex items-center gap-2">
                            <FaUserShield />
                            Role
                          </div>
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wider">
                          <div className="flex items-center gap-2">
                            <FaCheckCircle />
                            Status
                          </div>
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wider">
                          <div className="flex items-center gap-2">
                            <FaCalendarAlt />
                            Joined
                          </div>
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((userData) => (
                        <tr key={userData.id} className="hover:bg-blue-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                                userData.role === 'admin' ? 'bg-gradient-to-br from-red-500 to-red-600' :
                                userData.role === 'instructor' ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                                'bg-gradient-to-br from-green-500 to-green-600'
                              }`}>
                                {userData.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-gray-900">{userData.name}</div>
                                <div className="text-xs text-gray-500">{userData.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full border ${getRoleBadgeColor(userData.role)}`}>
                              {userData.role === 'admin' && <FaCrown className="text-xs" />}
                              {userData.role === 'instructor' && <FaChalkboardTeacher className="text-xs" />}
                              {userData.role === 'student' && <FaUserGraduate className="text-xs" />}
                              {userData.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full ${
                              userData.verified 
                                ? "bg-green-100 text-green-800 border border-green-200" 
                                : "bg-yellow-100 text-yellow-800 border border-yellow-200"
                            }`}>
                              {userData.verified ? <FaCheckCircle /> : <FaClock />}
                              {userData.verified ? "Verified" : "Pending"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <FaCalendarAlt className="text-gray-400" />
                              {new Date(userData.created_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {userData.id !== user?.id && (
                              <div className="flex flex-wrap gap-2">
                                {userData.role !== "admin" && (
                                  <button
                                    onClick={() => handleRoleChange(userData.id, "admin", userData.name)}
                                    disabled={roleChangeLoading === userData.id}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                                  >
                                    {roleChangeLoading === userData.id ? "..." : "→ Admin"}
                                  </button>
                                )}
                                {userData.role !== "instructor" && (
                                  <button
                                    onClick={() => handleRoleChange(userData.id, "instructor", userData.name)}
                                    disabled={roleChangeLoading === userData.id}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                                  >
                                    {roleChangeLoading === userData.id ? "..." : "→ Instructor"}
                                  </button>
                                )}
                                {userData.role !== "student" && (
                                  <button
                                    onClick={() => handleRoleChange(userData.id, "student", userData.name)}
                                    disabled={roleChangeLoading === userData.id}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                                  >
                                    {roleChangeLoading === userData.id ? "..." : "→ Student"}
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

                {/* Mobile Card View - Enhanced */}
                <div className="lg:hidden">
                  {users.map((userData) => (
                    <div 
                      key={userData.id} 
                      className="border-b-2 border-gray-200 p-4 sm:p-5 hover:bg-blue-50/50 transition-colors"
                    >
                      <div className="flex items-start gap-3 mb-4">
                        <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-white font-bold text-lg sm:text-xl shadow-lg ${
                          userData.role === 'admin' ? 'bg-gradient-to-br from-red-500 to-red-600' :
                          userData.role === 'instructor' ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                          'bg-gradient-to-br from-green-500 to-green-600'
                        }`}>
                          {userData.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 text-base sm:text-lg mb-1">{userData.name}</h3>
                          <p className="text-xs sm:text-sm text-gray-500 truncate">{userData.email}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full border ${getRoleBadgeColor(userData.role)}`}>
                              {userData.role === 'admin' && <FaCrown className="text-xs" />}
                              {userData.role === 'instructor' && <FaChalkboardTeacher className="text-xs" />}
                              {userData.role === 'student' && <FaUserGraduate className="text-xs" />}
                              {userData.role}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full ${
                              userData.verified 
                                ? "bg-green-100 text-green-800 border border-green-200" 
                                : "bg-yellow-100 text-yellow-800 border border-yellow-200"
                            }`}>
                              {userData.verified ? <FaCheckCircle /> : <FaClock />}
                              {userData.verified ? "Verified" : "Pending"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 mb-4 pl-15">
                        <FaCalendarAlt />
                        <span>Joined: {new Date(userData.created_at).toLocaleDateString()}</span>
                      </div>

                      {userData.id !== user?.id && (
                        <div className="flex flex-wrap gap-2 pl-15">
                          {userData.role !== "admin" && (
                            <button
                              onClick={() => handleRoleChange(userData.id, "admin", userData.name)}
                              disabled={roleChangeLoading === userData.id}
                              className="flex items-center gap-1 px-3 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              {roleChangeLoading === userData.id ? "..." : "→ Admin"}
                            </button>
                          )}
                          {userData.role !== "instructor" && (
                            <button
                              onClick={() => handleRoleChange(userData.id, "instructor", userData.name)}
                              disabled={roleChangeLoading === userData.id}
                              className="flex items-center gap-1 px-3 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              {roleChangeLoading === userData.id ? "..." : "→ Instructor"}
                            </button>
                          )}
                          {userData.role !== "student" && (
                            <button
                              onClick={() => handleRoleChange(userData.id, "student", userData.name)}
                              disabled={roleChangeLoading === userData.id}
                              className="flex items-center gap-1 px-3 py-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              {roleChangeLoading === userData.id ? "..." : "→ Student"}
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