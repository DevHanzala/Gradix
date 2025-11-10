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

// NEW: Import Physical Paper Modal
import PhysicalPaperModal from "../../components/PhysicalPaperModal.jsx";

function InstructorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { assessments, getInstructorAssessments } = useAssessmentStore();
  const { overview, loading, getInstructorOverview } = useDashboardStore();
  const [modal, setModal] = useState({ isOpen: false, type: "info", title: "", message: "" });
  const [isLoading, setIsLoading] = useState(true);

  // NEW: State for Physical Paper Modal
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
        const errorMessage = error.response?.data?.message || error.message || "Failed to fetch dashboard data. Please try again.";
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

  // NEW: Open Physical Paper Modal
  const openPaperModal = (assessment) => {
    setPaperModal({
      isOpen: true,
      assessmentId: assessment.id,
      title: assessment.title,
    });
  };

  // ICONS USING react-icons/fa
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
      link: "/instructor/assessments/:assessmentId/analytics",
      color: "bg-indigo-500 hover:bg-indigo-600",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                <CardContent className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{overview.assessments || 0}</div>
                  <div className="text-gray-600">My Assessments</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="text-center">
                  <div className="text-3xl font-bold text-green-600">{overview.resources || 0}</div>
                  <div className="text-gray-600">Resources</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="text-center">
                  <div className="text-3xl font-bold text-purple-600">{overview.executedAssessments || 0}</div>
                  <div className="text-gray-600">Executed Assessments</div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card className="mb-8">
              <CardHeader>
                <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {quickActions.map((action, index) => (
                    <Link
                      key={index}
                      to={action.link}
                      className={`${action.color} text-white p-6 rounded-lg transition duration-200 block text-center`}
                    >
                      <div className="flex justify-center mb-2">
                        {action.icon}
                      </div>
                      <h3 className="font-semibold text-lg mb-1">{action.title}</h3>
                      <p className="text-sm opacity-90">{action.description}</p>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Assessments */}
            <Card className="mb-8">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-gray-900">Recent Assessments</h2>
                  <Link to="/instructor/assessments" className="text-blue-600 hover:text-blue-800">
                    View All
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {!assessments || assessments.length === 0 ? (
                  <div className="text-center py-8">
                    <FaPen className="text-6xl text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Assessments Yet</h3>
                    <p className="text-gray-600 mb-4">Create your first assessment to get started.</p>
                    <Link
                      to="/instructor/assessments/create"
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-200"
                    >
                      Create Your First Assessment
                    </Link>
                  </div>
                ) : (
                  <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                            Assessment Title
                          </th>
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                            Created
                          </th>
                          <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {assessments.filter(assessment => assessment && assessment.id).slice(0, 5).map((assessment) => (
                          <tr key={assessment.id} className="hover:bg-gray-50 transition-colors">
                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                              {assessment.title}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                              {new Date(assessment.created_at).toLocaleDateString()}
                            </td>
                            <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 flex justify-end space-x-4">
                              <Link to={`/instructor/assessments/${assessment.id}`} className="text-blue-600 hover:text-blue-900 flex items-center">
                                <FaEye className="mr-1" /> <span className="hidden sm:inline">View</span>
                              </Link>
                              <Link to={`/instructor/assessments/${assessment.id}/enroll`} className="text-green-600 hover:text-green-900 flex items-center">
                                <FaFilePdf className="mr-1" /> <span className="hidden sm:inline">Enroll</span>
                              </Link>
                              {!assessment.is_executed && (
                                <Link to={`/instructor/assessments/${assessment.id}/edit`} className="text-yellow-600 hover:text-yellow-900 flex items-center">
                                  <FaEdit className="mr-1" /> <span className="hidden sm:inline">Edit</span>
                                </Link>
                              )}
                              {!assessment.is_executed && (
                                <button
                                  onClick={() => {
                                    if (window.confirm(`Are you sure you want to delete "${assessment.title}"?`)) {
                                      useAssessmentStore.getState().deleteAssessment(assessment.id).then(() => {
                                        showModal("success", "Success", "Assessment deleted successfully");
                                      }).catch((err) => {
                                        showModal("error", "Error", err.message || "Failed to delete assessment");
                                      });
                                    }
                                  }}
                                  className="text-red-600 hover:text-red-900 flex items-center"
                                >
                                  <FaTrash className="mr-1" /> <span className="hidden sm:inline">Delete</span>
                                </button>
                              )}
                              {assessment.is_executed && (
                                <Link to={`/instructor/assessments/${assessment.id}/analytics`} className="text-indigo-600 hover:text-indigo-900 flex items-center">
                                  <FaChartBar className="mr-1" /> <span className="hidden sm:inline">Analytics</span>
                                </Link>
                              )}

                              {/* Physical Paper Button */}
                              <button
                                onClick={() => openPaperModal(assessment)}
                                className="text-orange-600 hover:text-orange-900 flex items-center"
                              >
                                <FaFilePdf className="mr-1" />
                                <span className="hidden sm:inline">Physical Paper</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Footer />

      {/* NEW: Physical Paper Modal */}
      <PhysicalPaperModal
        isOpen={paperModal.isOpen}
        onClose={() => setPaperModal({ ...paperModal, isOpen: false })}
        assessmentId={paperModal.assessmentId}
        assessmentTitle={paperModal.title}
      />

      {/* Existing Modal */}
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