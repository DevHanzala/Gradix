import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuthStore from "../../store/authStore.js";
import useAssessmentStore from "../../store/assessmentStore.js";
import useDashboardStore from "../../store/dashboardStore.js";
import { Card, CardHeader, CardContent } from "../../components/ui/Card.jsx";
import LoadingSpinner from "../../components/ui/LoadingSpinner.jsx";
import Modal from "../../components/ui/Modal.jsx";
import Navbar from "../../components/Navbar.jsx";
import Footer from "../../components/Footer.jsx";
import toast from "react-hot-toast";
import {
  FaEye,
  FaEdit,
  FaTrash,
  FaChartBar,
  FaFilePdf,
  FaPen,
  FaBook,
  FaSchool,
  FaUserGraduate,
  FaChartLine,
  FaUserPlus,
  FaClipboardList,
  FaCalendarAlt,
  FaBinoculars,
} from "react-icons/fa";

// Physical Paper Modal
import PhysicalPaperModal from "../../components/PhysicalPaperModal.jsx";

function InstructorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { assessments, getInstructorAssessments } = useAssessmentStore();
  const { overview, loading, getInstructorOverview } = useDashboardStore();
  const [modal, setModal] = useState({ isOpen: false, type: "info", title: "", message: "" });
  const [isLoading, setIsLoading] = useState(true);

  const [paperModal, setPaperModal] = useState({
    isOpen: false,
    assessmentId: null,
    title: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          getInstructorAssessments(),
          getInstructorOverview(),
        ]);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        const errorMessage = error.response?.data?.message || error.message || "Failed to fetch dashboard data.";
        setModal({ isOpen: true, type: "error", title: "Error", message: errorMessage });
        toast.error(errorMessage);
        if (error.response?.status === 403 || error.message === "No authentication token found") {
          navigate("/login");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [getInstructorAssessments, getInstructorOverview, navigate]);

  const showModal = (type, title, message) => {
    setModal({ isOpen: true, type, title, message });
    toast[type === "success" ? "success" : "error"](message);
  };

  const openPaperModal = (assessment) => {
    setPaperModal({
      isOpen: true,
      assessmentId: assessment.id,
      title: assessment.title,
    });
  };

  const quickActions = [
    {
      title: "Create Assessment",
      description: "Add a new assessment",
      icon: <FaPen className="w-7 h-7" />,
      link: "/instructor/assessments/create",
      color: "bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700",
      shadow: "shadow-blue-200",
    },
    {
      title: "Manage Resources",
      description: "Upload or manage resources",
      icon: <FaBook className="w-7 h-7" />,
      link: "/instructor/resources",
      color: "bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700",
      shadow: "shadow-green-200",
    },
    {
      title: "My Assessments",
      description: "View & manage assessments",
      icon: <FaSchool className="w-7 h-7" />,
      link: "/instructor/assessments",
      color: "bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700",
      shadow: "shadow-purple-200",
    },
    {
      title: "Add New Student",
      description: "Register a new student",
      icon: <FaUserGraduate className="w-7 h-7" />,
      link: "/instructor/students",
      color: "bg-gradient-to-br from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700",
      shadow: "shadow-yellow-200",
    },
    {
      title: "View Analytics",
      description: "Analyze performance",
      icon: <FaChartLine className="w-7 h-7" />,
      link: "/instructor/assessments/:assessmentId/analytics",
      color: "bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700",
      shadow: "shadow-indigo-200",
    },
  ];

  const statsData = [
    {
      value: overview.assessments || 0,
      label: "My Assessments",
      icon: <FaClipboardList className="w-8 h-8" />,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
    },
    {
      value: overview.resources || 0,
      label: "Resources",
      icon: <FaBook className="w-8 h-8" />,
      color: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
    },
    {
      value: overview.executedAssessments || 0,
      label: "Executed Assessments",
      icon: <FaChartBar className="w-8 h-8" />,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
      <Navbar />
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        {/* Welcome Section - Enhanced */}
        <div className="mb-8 sm:mb-10">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl sm:rounded-3xl p-6 sm:p-8 lg:p-10 shadow-2xl text-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 sm:mb-3">
                  Welcome Back, {user?.name}! 👋
                </h1>
                <p className="text-blue-100 text-sm sm:text-base lg:text-lg">
                  Manage your assessments, track student progress, and create engaging learning experiences.
                </p>
              </div>
              <div className="hidden sm:block">
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 lg:p-6">
                  <FaCalendarAlt className="w-10 h-10 lg:w-12 lg:h-12 mx-auto mb-2" />
                  <p className="text-xs lg:text-sm font-semibold text-center">
                    {new Date().toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {isLoading || loading ? (
          <div className="flex justify-center items-center h-64 sm:h-80">
            <div className="text-center">
              <LoadingSpinner size="lg" color="purple" type="dots" />
              <span className="ml-3 text-gray-600 text-sm sm:text-base">Loading dashboard data...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Stats - Enhanced with Icons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-10">
              {statsData.map((stat, index) => (
                <Card key={index} className={`border-2 ${stat.borderColor} hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1`}>
                  <CardContent className="p-6 sm:p-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`text-3xl sm:text-4xl lg:text-5xl font-bold ${stat.color} mb-2`}>
                          {stat.value}
                        </div>
                        <div className="text-gray-600 text-sm sm:text-base font-medium">{stat.label}</div>
                      </div>
                      <div className={`${stat.bgColor} ${stat.color} p-4 sm:p-5 rounded-2xl`}>
                        {stat.icon}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Quick Actions - Enhanced */}
            <Card className="mb-8 sm:mb-10 border-2 border-gray-200 shadow-lg">
              <CardHeader className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50/50">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <span className="bg-blue-600 text-white p-2 rounded-lg">
                    <FaSchool className="w-5 h-5" />
                  </span>
                  Quick Actions
                </h2>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 lg:p-8">
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
                  {quickActions.map((action, index) => (
                    <Link
                      key={index}
                      to={action.link}
                      className={`${action.color} text-white p-4 sm:p-6 lg:p-8 rounded-xl sm:rounded-2xl transition-all duration-300 shadow-lg hover:shadow-2xl ${action.shadow} transform hover:-translate-y-2 text-center group`}
                    >
                      <div className="flex justify-center mb-3 sm:mb-4 transform group-hover:scale-110 transition-transform duration-300">
                        {action.icon}
                      </div>
                      <h3 className="font-bold text-sm sm:text-base lg:text-lg mb-1">{action.title}</h3>
                      <p className="text-xs sm:text-sm opacity-90">{action.description}</p>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Assessments - Enhanced */}
            <Card className="border-2 border-gray-200 shadow-lg">
              <CardHeader className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-purple-50/50">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <span className="bg-purple-600 text-white p-2 rounded-lg">
                      <FaClipboardList className="w-5 h-5" />
                    </span>
                    Recent Assessments
                  </h2>
                  <Link
                    to="/instructor/assessments"
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold text-sm sm:text-base transition-colors group"
                  >
                    View All
                    <span className="transform group-hover:translate-x-1 transition-transform">→</span>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 lg:p-8">
                {!assessments || assessments.length === 0 ? (
                  <div className="text-center py-12 sm:py-16 lg:py-20">
                    <div className="bg-gradient-to-br from-blue-100 to-purple-100 w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center mx-auto mb-6">
                      <FaPen className="text-4xl sm:text-5xl text-blue-600" />
                    </div>
                    <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-3">No Assessments Yet</h3>
                    <p className="text-gray-600 mb-6 sm:mb-8 text-sm sm:text-base max-w-md mx-auto px-4">
                      Create your first assessment to start evaluating your students' progress and performance.
                    </p>
                    <Link
                      to="/instructor/assessments/create"
                      className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-base sm:text-lg font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                    >
                      <FaPen />
                      Create Your First Assessment
                    </Link>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table - Enhanced */}
                    <div className="hidden lg:block overflow-x-auto rounded-xl border-2 border-gray-200 shadow-sm">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gradient-to-r from-gray-100 to-blue-50">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wider">
                              Assessment Title
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wider">
                              Created On
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-800 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {assessments.slice(0, 5).map((assessment) => (
                            <tr key={assessment.id} className="hover:bg-blue-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
                                    <FaClipboardList className="w-4 h-4" />
                                  </div>
                                  <span className="font-semibold text-gray-900">{assessment.title}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                <div className="flex items-center gap-2">
                                  <FaCalendarAlt className="text-gray-400" />
                                  {new Date(assessment.created_at).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${assessment.is_executed
                                  ? "bg-green-100 text-green-700"
                                  : "bg-yellow-100 text-yellow-700"
                                  }`}>
                                  {assessment.is_executed ? "Executed" : "Draft"}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm">
                                <div className="flex flex-wrap items-center gap-3">
                                  <Link
                                    to={`/instructor/assessments/${assessment.id}`}
                                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold hover:underline transition"
                                  >
                                    <FaEye />
                                    View
                                  </Link>
                                  <Link
                                    to={`/instructor/assessments/${assessment.id}/enroll`}
                                    className="inline-flex items-center gap-1 text-green-600 hover:text-green-800 font-semibold hover:underline transition"
                                  >
                                    <FaUserPlus />
                                    Enroll
                                  </Link>
                                  {!assessment.is_executed && (
                                    <Link
                                      to={`/instructor/assessments/${assessment.id}/edit`}
                                      className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold hover:underline transition"
                                    >
                                      <FaEdit />
                                      Edit
                                    </Link>
                                  )}
                                  {!assessment.is_executed && (
                                    <button
                                      onClick={() => {
                                        if (window.confirm(`Delete "${assessment.title}"?`)) {
                                          useAssessmentStore.getState().deleteAssessment(assessment.id)
                                            .then(() => showModal("success", "Deleted!", "Assessment removed successfully"))
                                            .catch(() => showModal("error", "Error", "Failed to delete"));
                                        }
                                      }}
                                      className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 font-semibold hover:underline transition"
                                    >
                                      <FaTrash />
                                      Delete
                                    </button>
                                  )}
                                  {assessment.is_executed && (
                                    <Link
                                      to={`/instructor/assessments/${assessment.id}/analytics`}
                                      className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 font-semibold hover:underline transition"
                                    >
                                      <FaChartBar />
                                      Analytics
                                    </Link>
                                  )}
                                  <button
                                    onClick={() => openPaperModal(assessment)}
                                    className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-800 font-semibold hover:underline transition"
                                  >
                                    <FaFilePdf />
                                    Paper
                                  </button>
                                  {!assessment.is_executed && (
                                    <Link
                                      to={`/instructor/assessments/${assessment.id}/preview`}
                                      className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-800 font-semibold hover:underline transition"
                                    >
                                      <FaBinoculars />
                                      Preview
                                    </Link>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile/Tablet Cards - Enhanced */}
                    <div className="lg:hidden space-y-4">
                      {assessments.slice(0, 5).map((assessment) => (
                        <div
                          key={assessment.id}
                          className="bg-white border-2 border-gray-200 rounded-2xl p-4 sm:p-6 shadow-md hover:shadow-xl transition-all duration-300 hover:border-blue-300"
                        >
                          <div className="flex items-start justify-between mb-4 gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className="bg-blue-100 text-blue-600 p-2 sm:p-3 rounded-xl flex-shrink-0">
                                <FaClipboardList className="w-4 h-4 sm:w-5 sm:h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1 break-words">
                                  {assessment.title}
                                </h3>
                                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500">
                                  <FaCalendarAlt />
                                  {new Date(assessment.created_at).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </div>
                              </div>
                            </div>
                            <span className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 ${assessment.is_executed
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                              }`}>
                              {assessment.is_executed ? "Executed" : "Draft"}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 sm:gap-3 text-sm">
                            <Link
                              to={`/instructor/assessments/${assessment.id}`}
                              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-blue-100 text-blue-700 rounded-lg sm:rounded-xl font-semibold hover:bg-blue-200 transition-colors"
                            >
                              <FaEye />
                              <span className="hidden xs:inline">View</span>
                            </Link>
                            <Link
                              to={`/instructor/assessments/${assessment.id}/enroll`}
                              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-green-100 text-green-700 rounded-lg sm:rounded-xl font-semibold hover:bg-green-200 transition-colors"
                            >
                              <FaUserPlus />
                              <span className="hidden xs:inline">Enroll</span>
                            </Link>
                            {!assessment.is_executed && (
                              <>
                                <Link
                                  to={`/instructor/assessments/${assessment.id}/edit`}
                                  className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-indigo-100 text-indigo-700 rounded-lg sm:rounded-xl font-semibold hover:bg-indigo-200 transition-colors"
                                >
                                  <FaEdit />
                                  <span className="hidden xs:inline">Edit</span>
                                </Link>
                                <button
                                  onClick={() => window.confirm(`Delete "${assessment.title}"?`) &&
                                    useAssessmentStore.getState().deleteAssessment(assessment.id)
                                  }
                                  className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-red-100 text-red-700 rounded-lg sm:rounded-xl font-semibold hover:bg-red-200 transition-colors"
                                >
                                  <FaTrash />
                                  <span className="hidden xs:inline">Delete</span>
                                </button>
                                <Link
                                  to={`/instructor/assessments/${assessment.id}/preview`}
                                  className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-teal-100 text-teal-700 rounded-lg sm:rounded-xl font-semibold hover:bg-teal-200 transition-colors col-span-2"
                                >
                                  <FaBinoculars />
                                  Preview
                                </Link>
                              </>
                            )}
                            {assessment.is_executed && (
                              <Link
                                to={`/instructor/assessments/${assessment.id}/analytics`}
                                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-purple-100 text-purple-700 rounded-lg sm:rounded-xl font-semibold hover:bg-purple-200 transition-colors"
                              >
                                <FaChartBar />
                                <span className="hidden xs:inline">Analytics</span>
                              </Link>
                            )}
                            <button
                              onClick={() => openPaperModal(assessment)}
                              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-orange-100 text-orange-700 rounded-lg sm:rounded-xl font-semibold hover:bg-orange-200 transition-colors col-span-2"
                            >
                              <FaFilePdf />
                              Physical Paper
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Footer />

      {/* Physical Paper Modal */}
      <PhysicalPaperModal
        isOpen={paperModal.isOpen}
        onClose={() => setPaperModal({ ...paperModal, isOpen: false })}
        assessmentId={paperModal.assessmentId}
        assessmentTitle={paperModal.title}
      />

      {/* Error/Success Modal */}
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

export default InstructorDashboard;