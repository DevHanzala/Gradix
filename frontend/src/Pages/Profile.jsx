import { Link, useNavigate } from "react-router-dom"; // Added useNavigate
import useAuthStore from "../store/authStore.js";
import { Card, CardHeader, CardContent } from "../components/ui/Card.jsx";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";

function Profile() {
  const { user } = useAuthStore();
  const navigate = useNavigate(); // Added navigate hook

  const getDashboardLink = () => {
    if (!user) return "/";
    switch (user.role) {
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
      case "admin":
        return "bg-red-100 text-red-800";
      case "instructor":
        return "bg-blue-100 text-blue-800";
      case "student":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case "admin":
        return "👑";
      case "instructor":
        return "👨‍🏫";
      case "student":
        return "👨‍🎓";
      default:
        return "👤";
    }
  };

  // Handler for the Change Password button
  const handleChangePassword = () => {
    if (user) {
      navigate("/forgot-password"); // Navigate to change password page
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {user ? (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">My Profile</h1>
              <p className="text-gray-600">Manage your account information and settings</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Profile Card */}
              <div className="lg:col-span-1">
                <Card>
                  <CardContent className="text-center">
                    <div className="text-6xl mb-4">{getRoleIcon(user.role)}</div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{user.name}</h2>
                    <p className="text-gray-600 mb-4">{user.email}</p>
                    <span
                      className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getRoleColor(user.role)}`}
                    >
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <div className="flex items-center justify-center">
                        <div className="text-green-500 mr-2">✓</div>
                        <span className="text-sm text-gray-600">Email Verified</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Details Card */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <h3 className="text-xl font-semibold text-gray-900">Account Information</h3>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                          <div className="bg-gray-50 px-4 py-3 rounded-lg border">
                            <p className="text-gray-900">{user.name}</p>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                          <div className="bg-gray-50 px-4 py-3 rounded-lg border">
                            <p className="text-gray-900">{user.email}</p>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                          <div className="bg-gray-50 px-4 py-3 rounded-lg border">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(
                                user.role,
                              )}`}
                            >
                              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                            </span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Account Status</label>
                          <div className="bg-gray-50 px-4 py-3 rounded-lg border">
                            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                              Active
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-gray-200">
                        <h4 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Link
                            to={getDashboardLink()}
                            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition duration-200 font-medium text-center"
                          >
                            Go to Dashboard
                          </Link>
                          <button
                            onClick={handleChangePassword} // Added click handler
                            className="bg-gray-100 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-200 transition duration-200 font-medium"
                          >
                            Change Password
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
          <Card>
            <CardContent className="text-center py-12">
              <div className="text-4xl mb-4">🔒</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
              <p className="text-gray-600 mb-6">Please log in to view your profile.</p>
              <Link
                to="/login"
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition duration-200 font-medium"
              >
                Go to Login
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