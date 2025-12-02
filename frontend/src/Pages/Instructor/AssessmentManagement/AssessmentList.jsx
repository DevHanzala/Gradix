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
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="w-full mx-auto px-4 sm:px-4 lg:px-8 xl:px-10 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Assessments</h1>
            <p className="text-gray-600 mt-1">Manage and view all your assessments</p>
          </div>
          <Link
            to="/instructor/assessments/create"
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-md text-sm font-medium"
          >
            + Create Assessment
          </Link>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <input
              type="text"
              placeholder="Search assessments by title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </CardContent>
        </Card>

        {/* Loading or Content */}
        {isLoading || loading ? (
          <div className="flex justify-center items-center py-20">
            <LoadingSpinner size="lg" />
            <span className="ml-3 text-gray-600">Loading assessments...</span>
          </div>
        ) : filteredAssessments.length === 0 ? (
          <Card>
            <CardContent className="text-center py-16">
              <div className="text-6xl mb-4">No assessments</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {searchTerm ? "No assessments found" : "No assessments yet"}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchTerm ? "Try a different search term" : "Start by creating your first assessment"}
              </p>
              {!searchTerm && (
                <Link
                  to="/instructor/assessments/create"
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  Create Your First Assessment
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Desktop Table - Hidden on Mobile */}
            <div className="hidden lg:block">
              <Card>
                <CardHeader>
                  <h2 className="text-xl font-semibold text-gray-900">
                    All Assessments ({filteredAssessments.length})
                  </h2>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Title
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Created
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Questions
                          </th>
                          <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider pr-8">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredAssessments.map((a) => (
                          <tr key={a.id} className="hover:bg-gray-50 transition">
                            <td className="px-6 py-4 font-medium text-gray-900">{a.title}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {new Date(a.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {a.question_blocks?.length || 0}
                            </td>
                            <td className="px-6 py-4 text-right text-sm font-medium">
                              <Link to={`/instructor/assessments/${a.id}`} className="text-blue-600 hover:text-blue-800 mr-4">
                                View
                              </Link>
                              {!a.is_executed && (
                                <Link to={`/instructor/assessments/${a.id}/edit`} className="text-green-600 hover:text-green-800 mr-4">
                                  Edit
                                </Link>
                              )}
                              <button
                                onClick={() => handleDeleteAssessment(a.id, a.title)}
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
                </CardContent>
              </Card>
            </div>

            {/* Mobile Cards - Only visible on mobile/tablet */}
            <div className="lg:hidden space-y-4">
              {filteredAssessments.map((a) => (
                <Card key={a.id} className="shadow-sm hover:shadow-md transition">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold text-lg text-gray-900">{a.title}</h3>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {a.question_blocks?.length || 0} Qs
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      Created: {new Date(a.created_at).toLocaleDateString()}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Link
                        to={`/instructor/assessments/${a.id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                      >
                        View
                      </Link>
                      {!a.is_executed && (
                        <Link
                          to={`/instructor/assessments/${a.id}/edit`}
                          className="text-green-600 hover:text-green-800 font-medium text-sm"
                        >
                          Edit
                        </Link>
                      )}
                      <button
                        onClick={() => handleDeleteAssessment(a.id, a.title)}
                        className="text-red-600 hover:text-red-900 font-medium text-sm"
                      >
                        Delete
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