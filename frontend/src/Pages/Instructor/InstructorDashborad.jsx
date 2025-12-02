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
import axios from "axios";
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
  FaChartLine
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
      icon: <FaPen className="w-8 h-8" />,
      link: "/instructor/assessments/create",
      color: "bg-blue-500 hover:bg-blue-600",
    },
    {
      title: "Manage Resources",
      description: "Upload or manage resources",
      icon: <FaBook className="w-8 h-8" />,
      link: "/instructor/resources",
      color: "bg-green-500 hover:bg-green-600",
    },
    {
      title: "My Assessments",
      description: "View & manage assessments",
      icon: <FaSchool className="w-8 h-8" />,
      link: "/instructor/assessments",
      color: "bg-purple-500 hover:bg-purple-600",
    },
    {
      title: "Add New Student",
      description: "Register a new student",
      icon: <FaUserGraduate className="w-8 h-8" />,
      link: "/instructor/students",
      color: "bg-yellow-500 hover:bg-yellow-600",
    },
    {
      title: "View Analytics",
      description: "Analyze assessment performance",
      icon: <FaChartLine className="w-8 h-8" />,
      link: "/instructor/assessments",
      color: "bg-indigo-500 hover:bg-indigo-600",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Instructor Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user?.name}! Manage your assessments and resources.</p>
        </div>

        {isLoading || loading ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner size="lg" />
            <span className="ml-3 text-gray-600">Loading dashboard data...</span>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardContent className="text-center py-8">
                  <div className="text-4xl font-bold text-blue-600">{overview.assessments || 0}</div>
                  <div className="text-gray-600 mt-2">My Assessments</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="text-center py-8">
                  <div className="text-4xl font-bold text-green-600">{overview.resources || 0}</div>
                  <div className="text-gray-600 mt-2">Resources</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="text-center py-8">
                  <div className="text-4xl font-bold text-purple-600">{overview.executedAssessments || 0}</div>
                  <div className="text-gray-600 mt-2">Executed Assessments</div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card className="mb-8">
              <CardHeader>
                <h2 className="text-2xl font-semibold text-gray-900">Quick Actions</h2>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                  {quickActions.map((action, index) => (
                    <Link
                      key={index}
                      to={action.link}
                      className={`${action.color} text-white p-8 rounded-2xl transition duration-300 shadow-lg hover:shadow-2xl transform hover:-translate-y-1 text-center`}
                    >
                      <div className="flex justify-center mb-4">
                        {action.icon}
                      </div>
                      <h3 className="font-bold text-lg">{action.title}</h3>
                      <p className="text-sm opacity-90 mt-1">{action.description}</p>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Assessments */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-semibold text-gray-900">Recent Assessments</h2>
                  <Link to="/instructor/assessments" className="text-blue-600 hover:text-blue-800 font-medium">
                    View All →
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {!assessments || assessments.length === 0 ? (
                  <div className="text-center py-16">
                    <FaPen className="text-7xl text-gray-300 mx-auto mb-6" />
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">No Assessments Yet</h3>
                    <p className="text-gray-600 mb-6">Create your first assessment to get started.</p>
                    <Link
                      to="/instructor/assessments/create"
                      className="px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 transition shadow-lg"
                    >
                      Create Assessment
                    </Link>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table - Hidden on Mobile */}
                    <div className="hidden lg:block overflow-x-auto rounded-lg border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                              Assessment Title
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                              Created On
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {assessments.slice(0, 5).map((assessment) => (
                            <tr key={assessment.id} className="hover:bg-gray-50 transition">
                              <td className="px-6 py-4 font-medium text-gray-900">
                                {assessment.title}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {new Date(assessment.created_at).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </td>
                              <td className="px-6 py-4 text-sm">
                                <div className="flex flex-wrap items-center gap-3">
                                  <Link to={`/instructor/assessments/${assessment.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                                    View
                                  </Link>
                                  <Link to={`/instructor/assessments/${assessment.id}/enroll`} className="text-green-600 hover:text-green-800 font-medium">
                                    Enroll
                                  </Link>
                                  {!assessment.is_executed && (
                                    <Link to={`/instructor/assessments/edit/${assessment.id}`} className="text-indigo-600 hover:text-indigo-800 font-medium">
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
                                      className="text-red-600 hover:text-red-800 font-medium"
                                    >
                                      Delete
                                    </button>
                                  )}
                                  {assessment.is_executed && (
                                    <Link to={`/instructor/assessments/${assessment.id}/analytics`} className="text-purple-600 hover:text-purple-800 font-medium">
                                      Analytics
                                    </Link>
                                  )}
                                  <button
                                    onClick={() => openPaperModal(assessment)}
                                    className="text-orange-600 hover:text-orange-800 font-medium flex items-center gap-1"
                                  >
                                    Physical Paper
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Cards - Clean & Beautiful */}
                    <div className="lg:hidden space-y-4">
                      {assessments.slice(0, 5).map((assessment) => (
                        <div
                          key={assessment.id}
                          className="bg-white border border-gray-200 rounded-2xl p-6 shadow-md hover:shadow-lg transition-shadow"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-bold text-gray-900 pr-2">
                              {assessment.title}
                            </h3>
                            <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                              {new Date(assessment.created_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-3 text-sm">
                            <Link
                              to={`/instructor/assessments/${assessment.id}`}
                              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-medium hover:bg-blue-200 transition"
                            >
                              View
                            </Link>
                            <Link
                              to={`/instructor/assessments/${assessment.id}/enroll`}
                              className="px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium hover:bg-green-200 transition"
                            >
                              Enroll
                            </Link>
                            {!assessment.is_executed && (
                              <Link
                                to={`/instructor/assessments/edit/${assessment.id}`}
                                className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg font-medium hover:bg-indigo-200 transition"
                              >
                                Edit
                              </Link>
                            )}
                            {!assessment.is_executed && (
                              <button
                                onClick={() => window.confirm(`Delete "${assessment.title}"?`) &&
                                  useAssessmentStore.getState().deleteAssessment(assessment.id)
                                }
                                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition"
                              >
                                Delete
                              </button>
                            )}
                            {assessment.is_executed && (
                              <Link
                                to={`/instructor/assessments/${assessment.id}/analytics`}
                                className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg font-medium hover:bg-purple-200 transition"
                              >
                                Analytics
                              </Link>
                            )}
                            <button
                              onClick={() => openPaperModal(assessment)}
                              className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg font-medium hover:bg-orange-200 transition flex items-center gap-1"
                            >
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