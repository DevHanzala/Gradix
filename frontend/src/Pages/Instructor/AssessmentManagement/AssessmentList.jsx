import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import useAssessmentStore from "../../../store/assessmentStore.js";
import { Card, CardHeader, CardContent } from "../../../components/ui/Card";
import LoadingSpinner from "../../../components/ui/LoadingSpinner";
import Modal from "../../../components/ui/Modal";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import toast from "react-hot-toast";
import {
  FaEye,
  FaEdit,
  FaTrash,
  FaChartBar,
  FaFilePdf,
  FaUserPlus,
  FaClipboardList,
  FaBinoculars
} from "react-icons/fa";

// Import Physical Paper Modal
import PhysicalPaperModal from "../../../components/PhysicalPaperModal.jsx";

function AssessmentList() {
  const { assessments, loading, getInstructorAssessments, deleteAssessment } = useAssessmentStore();
  const [modal, setModal] = useState({ isOpen: false, type: "info", title: "", message: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Paper Modal State
  const [paperModal, setPaperModal] = useState({
    isOpen: false,
    assessmentId: null,
    title: "",
  });

  const openPaperModal = (assessment) => {
    setPaperModal({
      isOpen: true,
      assessmentId: assessment.id,
      title: assessment.title,
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        await getInstructorAssessments();
      } catch (error) {
        showModal("error", "Error", "Failed to fetch assessments. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [getInstructorAssessments]);

  const showModal = (type, title, message) => {
    setModal({ isOpen: true, type, title, message });
    toast[type === "success" ? "success" : "error"](message);
  };

  const handleDeleteAssessment = async (assessmentId, assessmentTitle) => {
    if (window.confirm(`Are you sure you want to delete "${assessmentTitle}"?`)) {
      try {
        await deleteAssessment(assessmentId);
        showModal("success", "Success", "Assessment deleted successfully!");
        await getInstructorAssessments();
      } catch (error) {
        showModal("error", "Error", "Failed to delete assessment.");
      }
    }
  };

  const filteredAssessments = assessments?.filter(a =>
    a && a.id && a.title?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <Navbar />
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">My Assessments</h1>
            <p className="text-gray-600">Manage and view all your assessments</p>
          </div>
          <Link
            to="/instructor/assessments/create"
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg text-sm font-semibold flex items-center justify-center gap-2"
          >
            <span className="text-lg">+</span>
            <span>Create Assessment</span>
          </Link>
        </div>

        {/* Search */}
        <Card className="mb-6 shadow-md border-0">
          <CardContent className="p-5">
            <div className="relative">
              <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search assessments by title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Loading or Content */}
        {isLoading || loading ? (
          <Card className="shadow-md border-0">
            <CardContent>
              <div className="flex flex-col justify-center items-center py-20">
                <LoadingSpinner size="lg" type="spinner" color="blue" />
                <span className="mt-4 text-gray-600 font-medium">Loading assessments...</span>
              </div>
            </CardContent>
          </Card>
        ) : filteredAssessments.length === 0 ? (
          <Card className="shadow-md border-0">
            <CardContent className="text-center py-20">
              <div className="text-7xl mb-6">📝</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                {searchTerm ? "No assessments found" : "No assessments yet"}
              </h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                {searchTerm ? "Try a different search term or clear your search" : "Start by creating your first assessment to get started"}
              </p>
              {!searchTerm && (
                <Link
                  to="/instructor/assessments/create"
                  className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-semibold shadow-md hover:shadow-lg"
                >
                  <span className="text-xl">+</span>
                  <span>Create Your First Assessment</span>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block">
              <Card className="shadow-md border-0 overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-blue-50 border-b-2 border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">
                      All Assessments ({filteredAssessments.length})
                    </h2>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Title
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Created
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider pr-8">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {filteredAssessments.map((assessment) => (
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
                              {new Date(assessment.created_at).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${assessment.is_executed
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700"
                                }`}>
                                {assessment.is_executed ? "Executed" : "Draft"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex flex-wrap justify-end items-center gap-3">
                                <Link to={`/instructor/assessments/${assessment.id}`} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold hover:underline transition">
                                  <FaEye /> View
                                </Link>
                                <Link to={`/instructor/assessments/${assessment.id}/enroll`} className="inline-flex items-center gap-1 text-green-600 hover:text-green-800 font-semibold hover:underline transition">
                                  <FaUserPlus /> Enroll
                                </Link>
                                {!assessment.is_executed && (
                                  <Link to={`/instructor/assessments/${assessment.id}/edit`} className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold hover:underline transition">
                                    <FaEdit /> Edit
                                  </Link>
                                )}
                                {!assessment.is_executed && (
                                  <button onClick={() => handleDeleteAssessment(assessment.id, assessment.title)} className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 font-semibold hover:underline transition">
                                    <FaTrash /> Delete
                                  </button>
                                )}
                                {assessment.is_executed && (
                                  <Link to={`/instructor/assessments/${assessment.id}/analytics`} className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 font-semibold hover:underline transition">
                                    <FaChartBar /> Analytics
                                  </Link>
                                )}
                                <button onClick={() => openPaperModal(assessment)} className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-800 font-semibold hover:underline transition">
                                  <FaFilePdf /> Paper
                                </button>
                                {!assessment.is_executed && (
                                  <Link to={`/instructor/assessments/${assessment.id}/preview`} className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-800 font-semibold hover:underline transition">
                                    <FaBinoculars /> Preview
                                  </Link>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-4">
              {filteredAssessments.map((assessment) => (
                <Card key={assessment.id} className="shadow-md hover:shadow-lg transition-all duration-200 border-0">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg text-gray-900 mb-1">{assessment.title}</h3>
                        <p className="text-sm text-gray-600">
                          Created: {new Date(assessment.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${assessment.is_executed
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                        }`}>
                        {assessment.is_executed ? "Executed" : "Draft"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <Link to={`/instructor/assessments/${assessment.id}`} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition">
                        <FaEye /> View
                      </Link>
                      <Link to={`/instructor/assessments/${assessment.id}/enroll`} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition">
                        <FaUserPlus /> Enroll
                      </Link>
                      {!assessment.is_executed && (
                        <>
                          <Link to={`/instructor/assessments/${assessment.id}/edit`} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition">
                            <FaEdit /> Edit
                          </Link>
                          <button onClick={() => handleDeleteAssessment(assessment.id, assessment.title)} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition">
                            <FaTrash /> Delete
                          </button>
                          <Link to={`/instructor/assessments/${assessment.id}/preview`} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-100 text-teal-700 rounded-lg hover:bg-teal-200 transition col-span-2">
                            <FaBinoculars /> Preview
                          </Link>
                        </>
                      )}
                      {assessment.is_executed && (
                        <Link to={`/instructor/assessments/${assessment.id}/analytics`} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition">
                          <FaChartBar /> Analytics
                        </Link>
                      )}
                      <button onClick={() => openPaperModal(assessment)} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition col-span-2">
                        <FaFilePdf /> Physical Paper
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
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

      {/* General Modal */}
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

export default AssessmentList;