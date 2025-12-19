import { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardContent } from "../../components/ui/Card";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import toast from "react-hot-toast";
import useStudentAnalyticsStore from "../../store/useStudentAnalyticsStore.js";
import { 
  FaEye, 
  FaBook, 
  FaTrophy, 
  FaClock, 
  FaCheckCircle, 
  FaDownload,
  FaChartLine,
  FaTimesCircle
} from "react-icons/fa";
import axios from "axios";

const StudentAnalytics = () => {
  const {
    assessments,
    selectedAssessment,
    selectedAssessmentDetails,
    loading,
    error,
    fetchAssessments,
    fetchAssessmentDetails,
    setSelectedAssessment,
    downloadReport,
  } = useStudentAnalyticsStore();

  const [showType, setShowType] = useState(null);
  const [questionsData, setQuestionsData] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  const resultsRef = useRef(null);
  const questionsRef = useRef(null);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  useEffect(() => {
    if (selectedAssessment && showType === "results") {
      fetchAssessmentDetails(selectedAssessment);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 300);
    }
    if (selectedAssessment && showType === "questions") {
      setTimeout(() => questionsRef.current?.scrollIntoView({ behavior: "smooth" }), 300);
    }
  }, [selectedAssessment, showType, fetchAssessmentDetails]);

  const formatTime = (seconds) => {
    if (!seconds) return "0m 0s";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const handleSeeResults = (id) => {
    setSelectedAssessment(id);
    setShowType("results");
    setQuestionsData([]);
  };

  const handleSeeQuestions = async (id) => {
    setSelectedAssessment(id);
    setShowType("questions");
    setQuestionsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
      const { data } = await axios.get(`${API_URL}/student-analytics/assessment/${id}/questions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setQuestionsData(data.success ? data.data : []);
    } catch (err) {
      toast.error("Failed to load questions");
    } finally {
      setQuestionsLoading(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
        <div className="text-center">
          <LoadingSpinner size="lg" color="purple" type="gradient" />
          <p className="mt-4 text-gray-600 font-semibold">Loading analytics...</p>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
        <div className="text-center bg-white p-8 rounded-2xl shadow-2xl border-2 border-red-200">
          <FaTimesCircle className="text-6xl text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-600 mb-2">Error Loading Data</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
      <Navbar />

      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8 sm:mb-10">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl text-white text-center">
            <FaChartLine className="text-4xl sm:text-5xl mx-auto mb-4" />
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">My Analytics</h1>
            <p className="text-blue-100 text-sm sm:text-base">Review your performance and track your progress</p>
          </div>
        </div>

        {/* Assessment List */}
        <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto">
          {assessments.length > 0 ? (
            assessments.map((a) => (
              <Card
                key={a.id}
                className={`w-full shadow-xl hover:shadow-2xl transition-all duration-300 border-2 ${
                  selectedAssessment === a.id ? "border-indigo-500" : "border-gray-200"
                }`}
              >
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 sm:p-5 text-white rounded-t-xl">
                  <h3 className="text-lg sm:text-xl font-bold mb-1">{a.title}</h3>
                  <p className="text-xs sm:text-sm opacity-90 flex items-center gap-2">
                    <FaClock />
                    {new Date(a.date).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>

                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <p className="text-gray-600 font-semibold">
                      Click to review your answers and performance
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={() => handleSeeResults(a.id)}
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl"
                      >
                        <FaTrophy />
                        <span>Results</span>
                      </button>

                      <button
                        onClick={() => handleSeeQuestions(a.id)}
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
                      >
                        <FaEye />
                        <span>Questions</span>
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-16 sm:py-20 bg-white rounded-2xl shadow-xl border-2 border-gray-200">
              <div className="bg-gradient-to-br from-gray-100 to-blue-100 w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center mx-auto mb-6">
                <FaBook className="text-5xl sm:text-6xl text-gray-400" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-700 mb-2">No assessments completed yet</p>
              <p className="text-gray-500">Complete assessments to see your analytics here</p>
            </div>
          )}
        </div>

        {/* Results View */}
        {showType === "results" && selectedAssessmentDetails && (
          <div ref={resultsRef} className="mt-10 sm:mt-12 space-y-6 sm:space-y-8 max-w-5xl mx-auto">
            <Card className="shadow-2xl border-2 border-gray-200">
              <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-center py-6 sm:py-8">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold">{selectedAssessmentDetails.assessment_title}</h2>
              </CardHeader>

              <CardContent className="p-6 sm:p-8">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-center">
                  <div className="p-6 sm:p-8 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl shadow-xl transform hover:scale-105 transition-transform">
                    <FaTrophy className="text-4xl sm:text-5xl mx-auto mb-3" />
                    <p className="text-4xl sm:text-5xl font-extrabold">{selectedAssessmentDetails.score}%</p>
                    <p className="text-base sm:text-lg mt-2 font-semibold">Score</p>
                  </div>

                  <div className="p-6 sm:p-8 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl shadow-xl transform hover:scale-105 transition-transform">
                    <FaClock className="text-4xl sm:text-5xl mx-auto mb-3" />
                    <p className="text-3xl sm:text-4xl font-extrabold">{formatTime(selectedAssessmentDetails.time_taken)}</p>
                    <p className="text-base sm:text-lg mt-2 font-semibold">Time</p>
                  </div>

                  <div className="p-6 sm:p-8 bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-2xl shadow-xl transform hover:scale-105 transition-transform">
                    <FaCheckCircle className="text-4xl sm:text-5xl mx-auto mb-3" />
                    <p className="text-3xl sm:text-4xl font-extrabold">
                      {selectedAssessmentDetails.correct_answers} / {selectedAssessmentDetails.total_questions}
                    </p>
                    <p className="text-base sm:text-lg mt-2 font-semibold">Correct</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="text-center">
              <button
                onClick={() => downloadReport(selectedAssessment)}
                className="inline-flex items-center gap-3 px-8 sm:px-12 py-4 sm:py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all text-base sm:text-lg shadow-2xl hover:shadow-indigo-500/50 transform hover:-translate-y-1"
              >
                <FaDownload className="text-xl" />
                <span>Download Full Report (PDF)</span>
              </button>
            </div>
          </div>
        )}

        {/* Questions View */}
        {showType === "questions" && (
          <div ref={questionsRef} className="mt-10 sm:mt-12 space-y-6 sm:space-y-8 max-w-5xl mx-auto">
            {questionsLoading ? (
              <Card className="shadow-xl">
                <CardContent className="py-16 sm:py-20 text-center">
                  <LoadingSpinner size="lg" color="blue" type="dots" />
                  <p className="mt-4 text-gray-600 font-semibold">Loading questions...</p>
                </CardContent>
              </Card>
            ) : questionsData.length > 0 ? (
              questionsData.map((q, i) => (
                <Card key={i} className="shadow-2xl border-2 border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white p-4 sm:p-5">
                    <h3 className="text-base sm:text-lg lg:text-xl font-bold flex items-center gap-2">
                      <FaBook />
                      Question {q.question_order || i + 1} ({q.type})
                    </h3>
                  </div>
                  <CardContent className="p-5 sm:p-6 lg:p-8 space-y-6">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 p-4 sm:p-5 rounded-xl">
                      <p className="font-bold text-blue-900 mb-2 text-sm sm:text-base">Question:</p>
                      <p className="text-sm sm:text-base text-gray-800 leading-relaxed">{q.question}</p>
                    </div>

                    {["multiple_choice", "MCQ"].includes(q.type) && q.options && (
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 p-4 sm:p-5 rounded-xl">
                        <p className="font-bold text-purple-900 mb-3 text-sm sm:text-base">Options</p>
                        <div className="space-y-2">
                          {Object.entries(q.options).map(([k, v]) => (
                            <div key={k} className="bg-white border border-purple-200 p-3 rounded-lg text-gray-700 text-xs sm:text-sm">
                              <strong className="text-purple-600">{k}:</strong> {v}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 p-5 sm:p-6 rounded-xl text-center">
                        <FaCheckCircle className="text-3xl sm:text-4xl text-green-600 mx-auto mb-2" />
                        <p className="font-bold text-green-900 text-sm sm:text-base">Correct Answer</p>
                        <p className="text-xl sm:text-2xl font-extrabold text-green-600 mt-2">{q.correct_answer}</p>
                      </div>

                      <div className={`border-2 p-5 sm:p-6 rounded-xl text-center ${
                        q.is_correct 
                          ? "bg-gradient-to-br from-green-50 to-emerald-50 border-green-200" 
                          : "bg-gradient-to-br from-red-50 to-pink-50 border-red-200"
                      }`}>
                        {q.is_correct ? (
                          <FaCheckCircle className="text-3xl sm:text-4xl text-green-600 mx-auto mb-2" />
                        ) : (
                          <FaTimesCircle className="text-3xl sm:text-4xl text-red-600 mx-auto mb-2" />
                        )}
                        <p className="font-bold text-gray-900 text-sm sm:text-base">Your Answer</p>
                        <p className={`text-xl sm:text-2xl font-extrabold mt-2 ${q.is_correct ? "text-green-600" : "text-red-600"}`}>
                          {q.student_answer || "Not Answered"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="shadow-xl">
                <CardContent className="py-16 sm:py-20 text-center">
                  <FaBook className="text-6xl sm:text-7xl text-gray-300 mx-auto mb-4" />
                  <p className="text-lg sm:text-xl text-gray-500 font-semibold">No questions available</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default StudentAnalytics;