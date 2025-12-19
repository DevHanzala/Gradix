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
            {/* Desktop Table - Hidden on Mobile */}
            <div className="hidden lg:block">
              <Card className="shadow-md border-0 overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-blue-50 border-b-2 border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">
                      All Assessments
                    </h2>
                    <span className="bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-sm font-semibold">
                      {filteredAssessments.length} {filteredAssessments.length === 1 ? 'Assessment' : 'Assessments'}
                    </span>
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
                            Questions
                          </th>
                          <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider pr-8">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {filteredAssessments.map((a) => (
                          <tr key={a.id} className="hover:bg-blue-50 transition-colors duration-150">
                            <td className="px-6 py-5">
                              <div className="flex items-center">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center mr-3">
                                  <span className="text-blue-600 font-bold text-sm">📄</span>
                                </div>
                                <span className="font-semibold text-gray-900">{a.title}</span>
                              </div>
                            </td>
                            <td className="px-6 py-5 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {new Date(a.created_at).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="px-6 py-5 text-sm">
                              <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-medium text-xs">
                                {a.question_blocks?.length || 0} blocks
                              </span>
                            </td>
                            <td className="px-6 py-5 text-right text-sm font-medium space-x-1">
                              <Link 
                                to={`/instructor/assessments/${a.id}`} 
                                className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors duration-150 font-medium"
                              >
                                👁️ View
                              </Link>
                              {!a.is_executed && (
                                <Link 
                                  to={`/instructor/assessments/${a.id}/edit`} 
                                  className="inline-flex items-center px-3 py-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors duration-150 font-medium"
                                >
                                  ✏️ Edit
                                </Link>
                              )}
                              <button
                                onClick={() => handleDeleteAssessment(a.id, a.title)}
                                className="inline-flex items-center px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors duration-150 font-medium"
                              >
                                🗑️ Delete
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
                <Card key={a.id} className="shadow-md hover:shadow-lg transition-all duration-200 border-0 overflow-hidden">
                  <CardContent className="p-0">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4 border-b border-gray-200">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-lg text-gray-900 flex-1 pr-2">{a.title}</h3>
                        <span className="bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full font-semibold text-xs whitespace-nowrap">
                          {a.question_blocks?.length || 0} blocks
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>Created: {new Date(a.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="px-5 py-4 bg-white">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/instructor/assessments/${a.id}`}
                          className="flex-1 min-w-[120px] text-center px-4 py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors duration-150 font-semibold text-sm"
                        >
                          👁️ View
                        </Link>
                        {!a.is_executed && (
                          <Link
                            to={`/instructor/assessments/${a.id}/edit`}
                            className="flex-1 min-w-[120px] text-center px-4 py-2.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors duration-150 font-semibold text-sm"
                          >
                            ✏️ Edit
                          </Link>
                        )}
                        <button
                          onClick={() => handleDeleteAssessment(a.id, a.title)}
                          className="flex-1 min-w-[120px] px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors duration-150 font-semibold text-sm"
                        >
                          🗑️ Delete
                        </button>
                      </div>
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