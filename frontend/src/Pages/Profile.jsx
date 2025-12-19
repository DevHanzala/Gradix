import { Link, useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore.js";
import { Card, CardHeader, CardContent } from "../components/ui/Card.jsx";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import { 
  FaUser, 
  FaEnvelope, 
  FaShieldAlt, 
  FaCheckCircle, 
  FaTachometerAlt, 
  FaKey,
  FaCrown,
  FaChalkboardTeacher,
  FaGraduationCap
} from "react-icons/fa";

function Profile() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const getDashboardLink = () => {
    if (!user) return "/";
    switch (user.role) {
      case "super_admin":
        return "/super-admin/dashboard";
      case "admin":
        return "/admin/dashboard";
      case "instructor":
        return "/instructor/dashboard";
      case "student":
        return "/student/dashboard";
      default:
        return "/";
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case "super_admin":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "admin":
        return "bg-red-100 text-red-800 border-red-200";
      case "instructor":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "student":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case "super_admin":
        return <FaCrown className="text-4xl" />;
      case "admin":
        return <FaCrown className="text-4xl" />;
      case "instructor":
        return <FaChalkboardTeacher className="text-4xl" />;
      case "student":
        return <FaGraduationCap className="text-4xl" />;
      default:
        return <FaUser className="text-4xl" />;
    }
  };

  const getRoleGradient = (role) => {
    switch (role) {
      case "super_admin":
        return "from-purple-500 to-pink-500";
      case "admin":
        return "from-red-500 to-pink-500";
      case "instructor":
        return "from-blue-500 to-indigo-500";
      case "student":
        return "from-green-500 to-emerald-500";
      default:
        return "from-gray-500 to-gray-600";
    }
  };

  const handleChangePassword = () => {
    if (user) {
      navigate("/forgot-password");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {user ? (
          <>
            {/* Header */}
            <div className="mb-8 sm:mb-10">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl text-white">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">My Profile</h1>
                <p className="text-blue-100 text-sm sm:text-base">Manage your account information and settings</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
              {/* Profile Card */}
              <div className="lg:col-span-1">
                <Card className="shadow-2xl border-2 border-gray-200 overflow-hidden">
                  <div className={`bg-gradient-to-br ${getRoleGradient(user.role)} p-6 sm:p-8`}>
                    <div className="bg-white/20 backdrop-blur-sm w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mx-auto mb-4 text-white shadow-lg">
                      {getRoleIcon(user.role)}
                    </div>
                  </div>
                  <CardContent className="text-center p-6 sm:p-8">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{user.name}</h2>
                    <p className="text-gray-600 mb-4 text-sm sm:text-base break-words">{user.email}</p>
                    <span
                      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-full border-2 ${getRoleColor(user.role)}`}
                    >
                      {user.role === "super_admin" && <FaCrown className="text-xs" />}
                      {user.role === "admin" && <FaCrown className="text-xs" />}
                      {user.role === "instructor" && <FaChalkboardTeacher className="text-xs" />}
                      {user.role === "student" && <FaGraduationCap className="text-xs" />}
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1).replace("_", " ")}
                    </span>
                    <div className="mt-6 pt-6 border-t-2 border-gray-200">
                      <div className="flex items-center justify-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
                        <FaCheckCircle className="text-green-500 text-lg" />
                        <span className="text-sm font-semibold text-green-700">Email Verified</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Details Card */}
              <div className="lg:col-span-2">
                <Card className="shadow-2xl border-2 border-gray-200">
                  <CardHeader className="bg-gradient-to-r from-gray-50 to-blue-50 border-b-2 border-gray-200">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                      <FaUser className="text-blue-600" />
                      Account Information
                    </h3>
                  </CardHeader>
                  <CardContent className="p-6 sm:p-8">
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                        <div>
                          <label className=" text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                            <FaUser className="text-gray-400" />
                            Full Name
                          </label>
                          <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-4 py-3 rounded-xl border-2 border-gray-200">
                            <p className="text-gray-900 font-semibold">{user.name}</p>
                          </div>
                        </div>
                        <div>
                          <label className=" text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                            <FaEnvelope className="text-gray-400" />
                            Email Address
                          </label>
                          <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-4 py-3 rounded-xl border-2 border-gray-200 break-words">
                            <p className="text-gray-900 font-semibold text-sm">{user.email}</p>
                          </div>
                        </div>
                        <div>
                          <label className=" text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                            <FaShieldAlt className="text-gray-400" />
                            Role
                          </label>
                          <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-4 py-3 rounded-xl border-2 border-gray-200">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full border ${getRoleColor(
                                user.role,
                              )}`}
                            >
                              {user.role === "super_admin" && <FaCrown className="text-xs" />}
                              {user.role === "admin" && <FaCrown className="text-xs" />}
                              {user.role === "instructor" && <FaChalkboardTeacher className="text-xs" />}
                              {user.role === "student" && <FaGraduationCap className="text-xs" />}
                              {user.role.charAt(0).toUpperCase() + user.role.slice(1).replace("_", " ")}
                            </span>
                          </div>
                        </div>
                        <div>
                          <label className=" text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                            <FaCheckCircle className="text-gray-400" />
                            Account Status
                          </label>
                          <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-4 py-3 rounded-xl border-2 border-gray-200">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full bg-green-100 text-green-800 border border-green-200">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                              Active
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="pt-6 border-t-2 border-gray-200">
                        <h4 className="text-base sm:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <FaTachometerAlt className="text-blue-600" />
                          Quick Actions
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          <Link
                            to={getDashboardLink()}
                            className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 sm:py-4 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                          >
                            <FaTachometerAlt />
                            <span>Go to Dashboard</span>
                          </Link>
                          <button
                            onClick={handleChangePassword}
                            className="flex items-center justify-center gap-2 bg-white border-2 border-gray-300 text-gray-700 px-6 py-3 sm:py-4 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-bold shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                          >
                            <FaKey />
                            <span>Change Password</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        ) : (
          <Card className="shadow-2xl border-2 border-gray-200 max-w-2xl mx-auto">
            <CardContent className="text-center py-16 sm:py-20 px-6">
              <div className="bg-gradient-to-br from-red-100 to-orange-100 w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                <FaShieldAlt className="text-4xl sm:text-5xl text-red-600" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Access Denied</h2>
              <p className="text-gray-600 mb-8 text-sm sm:text-base">Please log in to view your profile.</p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <FaUser />
                <span>Go to Login</span>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      <Footer />
    </div>
  );
}

export default Profile;