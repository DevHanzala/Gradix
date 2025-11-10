import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import useAssessmentStore from "../../../store/assessmentStore.js";
import { Card, CardHeader, CardContent } from "../../../components/ui/Card";
import LoadingSpinner from "../../../components/ui/LoadingSpinner";
import Modal from "../../../components/ui/Modal";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import toast from "react-hot-toast";

function AssessmentList() {
  const { assessments, loading, getInstructorAssessments, deleteAssessment } = useAssessmentStore();
  const [modal, setModal] = useState({ isOpen: false, type: "info", title: "", message: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        await getInstructorAssessments();
      } catch (error) {
        console.error("Failed to fetch assessments:", error);
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
    if (window.confirm(`Are you sure you want to delete "${assessmentTitle}"? This action cannot be undone.`)) {
      try {
        await deleteAssessment(assessmentId);
        showModal("success", "Success", "Assessment deleted successfully!");
        setTimeout(() => {
          getInstructorAssessments();
        }, 1000);
      } catch (error) {
        console.error("Failed to delete assessment:", error);
        showModal("error", "Error", "Failed to delete assessment. Please try again.");
      }
    }
  };

  const filteredAssessments =
    assessments?.filter((assessment) => {
      if (!assessment || !assessment.id) {
        console.warn("⚠️ Invalid assessment in filteredAssessments:", assessment);
        return false;
      }
      const matchesSearch =
        assessment.title.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    }) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">My Assessments</h1>
              <p className="text-gray-600">Manage your assessments.</p>
            </div>
            <Link
              to="/instructor/assessments/create"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-200"
            >
              Create Assessment
            </Link>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-8">
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search assessments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assessment List */}
        {isLoading || loading ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner size="lg" />
            <span className="ml-3 text-gray-600">Loading assessments...</span>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">Assessments ({filteredAssessments.length})</h2>
              </div>
            </CardHeader>
            <CardContent>
              {filteredAssessments.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📝</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchTerm ? "No matching assessments" : "No assessments yet"}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {searchTerm
                      ? "Try adjusting your search criteria."
                      : "Create your first assessment to get started."}
                  </p>
                  {!searchTerm && (
                    <Link
                      to="/instructor/assessments/create"
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-200"
                    >
                      Create Your First Assessment
                    </Link>
                  )}
                </div>
              ) : (
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
                        >
                          Assessment Title
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Created
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Question Blocks
                        </th>
                        <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {filteredAssessments.map((assessment) => (
                        <tr key={assessment.id}>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                            {assessment.title}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {new Date(assessment.created_at).toLocaleDateString()}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {assessment.question_blocks?.length || 0}
                          </td>
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            {assessment.id ? (
                              <>
                                <Link
                                  to={`/instructor/assessments/${assessment.id}`}
                                  className="text-blue-600 hover:text-blue-900 mr-4"
                                  onClick={() => console.log(`🔗 Navigating to assessment ID: ${assessment.id}`)}
                                >
                                  View
                                </Link>
                                {!assessment.is_executed && (
                                  <Link
                                    to={`/instructor/assessments/${assessment.id}/edit`}
                                    className="text-green-600 hover:text-green-900 mr-4"
                                    onClick={() => console.log(`🔗 Navigating to edit assessment ID: ${assessment.id}`)}
                                  >
                                    Edit
                                  </Link>
                                )}
                              </>
                            ) : (
                              <span className="text-gray-500">Invalid ID</span>
                            )}
                            <button
                              onClick={() => handleDeleteAssessment(assessment.id, assessment.title)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
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
        )}
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

export default AssessmentList;