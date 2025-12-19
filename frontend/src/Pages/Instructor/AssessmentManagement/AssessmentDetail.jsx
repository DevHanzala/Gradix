import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import useAssessmentStore from "../../../store/assessmentStore.js";
import { Card, CardHeader, CardContent } from "../../../components/ui/Card";
import LoadingSpinner from "../../../components/ui/LoadingSpinner";
import Modal from "../../../components/ui/Modal";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import toast from "react-hot-toast";
import { FaInfoCircle, FaCalendarAlt, FaLink, FaQuestionCircle, FaFileAlt, FaExclamationCircle, FaEdit, FaUsers, FaPrint } from "react-icons/fa";

// THIS IS THE MISSING IMPORT — NOW ADDED
import PhysicalPaperModal from "../../../components/PhysicalPaperModal.jsx";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function AssessmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentAssessment, getAssessmentById, loading, error } = useAssessmentStore();
  const [modal, setModal] = useState({ isOpen: false, type: "info", title: "", message: "" });
  const [isLoading, setIsLoading] = useState(true);

  // THIS STATE CONTROLS THE PHYSICAL PAPER MODAL
  const [paperModal, setPaperModal] = useState({
    isOpen: false,
    assessmentId: null,
    title: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (!id || isNaN(parseInt(id))) {
          toast.error("Invalid assessment ID");
          navigate("/instructor/assessments");
          return;
        }
        await getAssessmentById(parseInt(id));
      } catch (error) {
        const msg = error.response?.data?.message || error.message || "Failed to load assessment";
        toast.error(msg);
        if (error.response?.status === 404) navigate("/instructor/assessments");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id, getAssessmentById, navigate]);

  const showModal = (type, title, message) => {
    setModal({ isOpen: true, type, title, message });
    toast[type === "success" ? "success" : "error"](message);
  };

  // THIS OPENS THE PHYSICAL PAPER MODAL
  const openPaperModal = (assessment) => {
    setPaperModal({
      isOpen: true,
      assessmentId: assessment.id,
      title: assessment.title,
    });
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <Navbar />
        <div className="flex flex-col justify-center items-center py-32">
          <LoadingSpinner size="lg" type="spinner" color="blue" />
          <span className="mt-4 text-gray-600 font-medium">Loading assessment...</span>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !currentAssessment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-16">
          <Card className="shadow-lg border-0">
            <CardContent className="text-center py-16">
              <FaExclamationCircle className="mx-auto text-7xl text-red-500 mb-6" />
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Assessment Not Found</h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                The requested assessment could not be loaded. It may have been deleted or you don't have access to it.
              </p>
              <Link 
                to="/instructor/assessments" 
                className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-semibold shadow-md hover:shadow-lg"
              >
                ← Back to Assessments
              </Link>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <Navbar />
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-8 sm:py-12 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Link 
              to="/instructor/assessments"
              className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors duration-200"
            >
              ← Back
            </Link>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Assessment Details</h1>
          <p className="text-gray-600">View and manage this assessment</p>
        </div>

        <Card className="shadow-lg border-0 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl sm:text-3xl font-bold mb-2 break-words">{currentAssessment.title}</h2>
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className={`px-3 py-1 rounded-full font-semibold ${currentAssessment.is_executed ? 'bg-green-500 bg-opacity-30' : 'bg-yellow-500 bg-opacity-30'}`}>
                    {currentAssessment.is_executed ? '✓ Executed' : '📝 Draft'}
                  </span>
                  <span className={`px-3 py-1 rounded-full font-semibold ${currentAssessment.is_published ? 'bg-blue-500 bg-opacity-30' : 'bg-gray-500 bg-opacity-30'}`}>
                    {currentAssessment.is_published ? '🌐 Published' : '🔒 Unpublished'}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                {!currentAssessment.is_executed && (
                  <Link 
                    to={`/instructor/assessments/${id}/edit`} 
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-200 font-semibold backdrop-blur-sm"
                  >
                    <FaEdit /> Edit
                  </Link>
                )}
                <Link 
                  to={`/instructor/assessments/${id}/enroll`} 
                  className="flex items-center gap-2  px-4 py-2.5 rounded-lg transition-all duration-200 font-semibold backdrop-blur-sm"
                >
                  <FaUsers /> Students
                </Link>
                <button
                  onClick={() => openPaperModal(currentAssessment)}
                  className="flex items-center gap-2  px-4 py-2.5 rounded-lg transition-all duration-200 font-semibold backdrop-blur-sm"
                >
                  <FaPrint /> Print PDF
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 sm:p-8 space-y-8">
            {/* Basic Info */}
            <section>
              <h3 className="text-xl font-bold flex items-center gap-2 mb-5 text-gray-900">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                  <FaInfoCircle className="text-blue-600 text-lg" />
                </div>
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-5 rounded-xl border-2 border-gray-200 hover:border-blue-300 transition-colors duration-200">
                  <span className="font-semibold text-gray-600 uppercase text-xs tracking-wide">Title</span>
                  <p className="mt-2 font-semibold text-gray-900 text-base">{currentAssessment.title}</p>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-5 rounded-xl border-2 border-gray-200 hover:border-blue-300 transition-colors duration-200">
                  <span className="font-semibold text-gray-600 uppercase text-xs tracking-wide">Prompt</span>
                  <p className="mt-2 text-gray-900">{currentAssessment.prompt || "—"}</p>
                </div>
              </div>
            </section>

            {/* Dates */}
            <section>
              <h3 className="text-xl font-bold flex items-center gap-2 mb-5 text-gray-900">
                <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center">
                  <FaCalendarAlt className="text-green-600 text-lg" />
                </div>
                Dates
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-gradient-to-br from-gray-50 to-green-50 p-5 rounded-xl border-2 border-gray-200 hover:border-green-300 transition-colors duration-200">
                  <span className="font-semibold text-gray-600 uppercase text-xs tracking-wide">Created</span>
                  <p className="mt-2 text-gray-900 font-medium">{new Date(currentAssessment.created_at).toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-green-50 p-5 rounded-xl border-2 border-gray-200 hover:border-green-300 transition-colors duration-200">
                  <span className="font-semibold text-gray-600 uppercase text-xs tracking-wide">Updated</span>
                  <p className="mt-2 text-gray-900 font-medium">{currentAssessment.updated_at ? new Date(currentAssessment.updated_at).toLocaleString() : "—"}</p>
                </div>
              </div>
            </section>

            {/* External Links */}
            <section>
              <h3 className="text-xl font-bold flex items-center gap-2 mb-5 text-gray-900">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex items-center justify-center">
                  <FaLink className="text-purple-600 text-lg" />
                </div>
                External Links
              </h3>
              {currentAssessment.external_links?.length > 0 ? (
                <div className="space-y-3">
                  {currentAssessment.external_links.map((link, i) => (
                    <a 
                      key={i} 
                      href={link} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 hover:border-purple-400 rounded-xl transition-all duration-200 group"
                    >
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-purple-200 transition-colors duration-200">
                        <FaLink className="text-purple-600 text-sm" />
                      </div>
                      <span className="text-blue-600 hover:text-blue-800 font-medium text-sm break-all flex-1">{link}</span>
                      <span className="text-gray-400 group-hover:text-gray-600 transition-colors duration-200">→</span>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                  <FaLink className="mx-auto text-4xl text-gray-300 mb-2" />
                  <p className="text-gray-500 italic">No external links</p>
                </div>
              )}
            </section>

            {/* Question Blocks - Desktop */}
            <section className="hidden lg:block">
              <h3 className="text-xl font-bold flex items-center gap-2 mb-5 text-gray-900">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-lg flex items-center justify-center">
                  <FaQuestionCircle className="text-indigo-600 text-lg" />
                </div>
                Question Blocks
              </h3>
              {currentAssessment.question_blocks?.length > 0 ? (
                <div className="overflow-hidden rounded-xl border-2 border-gray-200 shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gradient-to-r from-indigo-50 to-purple-50">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Type</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Count</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Time/Q</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Options</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">+Marks</th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">-Marks</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {currentAssessment.question_blocks.map((b, i) => (
                          <tr key={i} className="hover:bg-indigo-50 transition-colors duration-150">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                              <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold">
                                {b.question_type}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 font-medium">{b.question_count}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{b.duration_per_question}s</td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {b.question_type === "multiple_choice" ? b.num_options :
                               b.question_type === "matching" ? `${b.num_first_side}/${b.num_second_side}` : "—"}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <span className="bg-green-100 text-green-700 px-2 py-1 rounded font-semibold">
                                {b.positive_marks ?? "—"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <span className="bg-red-100 text-red-700 px-2 py-1 rounded font-semibold">
                                {b.negative_marks ?? "—"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                  <FaQuestionCircle className="mx-auto text-4xl text-gray-300 mb-2" />
                  <p className="text-gray-500 italic">No question blocks</p>
                </div>
              )}
            </section>

            {/* Question Blocks - Mobile */}
            <section className="lg:hidden space-y-4">
              <h3 className="text-xl font-bold flex items-center gap-2 text-gray-900">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-lg flex items-center justify-center">
                  <FaQuestionCircle className="text-indigo-600 text-lg" />
                </div>
                Question Blocks
              </h3>
              {currentAssessment.question_blocks?.length > 0 ? (
                currentAssessment.question_blocks.map((b, i) => (
                  <div key={i} className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-5 border-2 border-indigo-200 hover:border-indigo-400 transition-colors duration-200">
                    <div className="flex items-center justify-between mb-3">
                      <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                        Block {i + 1}
                      </span>
                      <span className="bg-white px-3 py-1 rounded-full text-xs font-bold text-indigo-600 border border-indigo-200">
                        {b.question_type}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <strong className="text-gray-600 text-xs uppercase">Count:</strong>
                        <p className="text-gray-900 font-semibold">{b.question_count}</p>
                      </div>
                      <div>
                        <strong className="text-gray-600 text-xs uppercase">Time/Q:</strong>
                        <p className="text-gray-900 font-semibold">{b.duration_per_question}s</p>
                      </div>
                      <div>
                        <strong className="text-gray-600 text-xs uppercase">Options:</strong>
                        <p className="text-gray-900 font-semibold">
                          {b.question_type === "multiple_choice" ? b.num_options : b.question_type === "matching" ? `${b.num_first_side}/${b.num_second_side}` : "—"}
                        </p>
                      </div>
                      <div>
                        <strong className="text-gray-600 text-xs uppercase">+/-Marks:</strong>
                        <p className="text-gray-900 font-semibold">
                          <span className="text-green-600">+{b.positive_marks ?? "—"}</span> / 
                          <span className="text-red-600 ml-1">-{b.negative_marks ?? "—"}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                  <FaQuestionCircle className="mx-auto text-4xl text-gray-300 mb-2" />
                  <p className="text-gray-500 italic">No question blocks</p>
                </div>
              )}
            </section>

            {/* Resources */}
            <section>
              <h3 className="text-xl font-bold flex items-center gap-2 mb-5 text-gray-900">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-orange-200 rounded-lg flex items-center justify-center">
                  <FaFileAlt className="text-orange-600 text-lg" />
                </div>
                Resources
              </h3>
              {currentAssessment.resources?.length > 0 ? (
                <div className="space-y-3">
                  {currentAssessment.resources.map((r, i) => (
                    <div 
                      key={i} 
                      className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gradient-to-r from-orange-50 to-yellow-50 p-5 rounded-xl border-2 border-orange-200 hover:border-orange-400 transition-all duration-200"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FaFileAlt className="text-orange-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900 truncate">{r.name}</p>
                          <p className="text-xs text-gray-600 bg-orange-100 inline-block px-2 py-0.5 rounded mt-1 font-medium">
                            {r.file_type}
                          </p>
                        </div>
                      </div>
                      <a 
                        href={r.file_path} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="px-4 py-2 bg-orange-600 text-white hover:bg-orange-700 rounded-lg transition-colors duration-200 font-semibold text-sm whitespace-nowrap"
                      >
                        View/Download
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                  <FaFileAlt className="mx-auto text-4xl text-gray-300 mb-2" />
                  <p className="text-gray-500 italic">No resources attached</p>
                </div>
              )}
            </section>
          </CardContent>
        </Card>
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
      <Modal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title}>
        {modal.message}
      </Modal>
    </div>
  );
}

export default AssessmentDetail;