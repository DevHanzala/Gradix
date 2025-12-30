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
  FaTimesCircle,
  FaArrowUp
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
  const [showScrollTop, setShowScrollTop] = useState(false);

  const resultsRef = useRef(null);
  const questionsRef = useRef(null);
  const assessmentsRef = useRef(null);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  // Handle scroll to show/hide back to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (selectedAssessment && showType === "results" && selectedAssessmentDetails) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ 
          behavior: "smooth", 
          block: "start"
        });
      }, 300);
    }
  }, [selectedAssessmentDetails, showType]);

  useEffect(() => {
    if (selectedAssessment && showType === "questions" && questionsData.length > 0) {
      setTimeout(() => {
        questionsRef.current?.scrollIntoView({ 
          behavior: "smooth", 
          block: "start"
        });
      }, 300);
    }
  }, [questionsData, showType]);

  const formatTime = (seconds) => {
    if (!seconds) return "0m 0s";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSeeResults = (id) => {
    setSelectedAssessment(id);
    setShowType("results");
    setQuestionsData([]);
    fetchAssessmentDetails(id);
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
        <div ref={assessmentsRef} className="space-y-4 sm:space-y-6 max-w-5xl mx-auto scroll-mt-24">
          {assessments.length > 0 ? (
            assessments.map((a) => (
              <Card
                key={a.id}
                className={`w-full shadow-xl hover:shadow-2xl transition-all duration-300 border-2 transform hover:-translate-y-1 ${
                  selectedAssessment === a.id 
                    ? "border-indigo-500 ring-4 ring-indigo-200" 
                    : "border-gray-200"
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
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
                      >
                        <FaTrophy />
                        <span>Results</span>
                      </button>

                      <button
                        onClick={() => handleSeeQuestions(a.id)}
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
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
          <div 
            ref={resultsRef} 
            className="mt-10 sm:mt-12 space-y-6 sm:space-y-8 max-w-5xl mx-auto scroll-mt-24 animate-fadeIn"
          >
            <Card className="shadow-2xl border-2 border-indigo-300 transform transition-all duration-500">
              <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-center py-6 sm:py-8">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold">
                  {selectedAssessmentDetails.assessment_title}
                </h2>
                <p className="text-indigo-100 text-sm mt-2">Performance Summary</p>
              </CardHeader>

              <CardContent className="p-6 sm:p-8">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-center">
                  <div className="p-6 sm:p-8 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl shadow-xl transform hover:scale-105 transition-transform duration-300 animate-slideInLeft">
                    <FaTrophy className="text-4xl sm:text-5xl mx-auto mb-3" />
                    <p className="text-4xl sm:text-5xl font-extrabold">{selectedAssessmentDetails.score}%</p>
                    <p className="text-base sm:text-lg mt-2 font-semibold">Score</p>
                  </div>

                  <div className="p-6 sm:p-8 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl shadow-xl transform hover:scale-105 transition-transform duration-300 animate-slideInUp">
                    <FaClock className="text-4xl sm:text-5xl mx-auto mb-3" />
                    <p className="text-3xl sm:text-4xl font-extrabold">{formatTime(selectedAssessmentDetails.time_taken)}</p>
                    <p className="text-base sm:text-lg mt-2 font-semibold">Time</p>
                  </div>

                  <div className="p-6 sm:p-8 bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-2xl shadow-xl transform hover:scale-105 transition-transform duration-300 animate-slideInRight">
                    <FaCheckCircle className="text-4xl sm:text-5xl mx-auto mb-3" />
                    <p className="text-3xl sm:text-4xl font-extrabold">
                      {selectedAssessmentDetails.correct_answers} / {selectedAssessmentDetails.total_questions}
                    </p>
                    <p className="text-base sm:text-lg mt-2 font-semibold">Correct</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="text-center animate-fadeIn">
              <button
                onClick={() => downloadReport(selectedAssessment)}
                className="inline-flex items-center gap-3 px-8 sm:px-12 py-4 sm:py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all text-base sm:text-lg shadow-2xl hover:shadow-indigo-500/50 transform hover:-translate-y-1 active:translate-y-0"
              >
                <FaDownload className="text-xl" />
                <span>Download Full Report (PDF)</span>
              </button>
            </div>
          </div>
        )}

        {/* Questions View */}
        {showType === "questions" && (
          <div 
            ref={questionsRef} 
            className="mt-10 sm:mt-12 space-y-6 sm:space-y-8 max-w-5xl mx-auto scroll-mt-24"
          >
            {/* Floating Back Arrow - Only at the end */}
            <button
              onClick={() => {
                setShowType(null);
                setTimeout(() => {
                  assessmentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
              }}
              className="fixed left-1/2 -translate-x-1/2 top-24 z-40 group animate-fadeIn"
              aria-label="Back to assessments"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full blur-xl opacity-40 group-hover:opacity-60 transition-opacity"></div>
                <div className="relative bg-gradient-to-r from-indigo-600 to-purple-600 p-4 rounded-full shadow-2xl transform transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1">
                  <FaArrowUp className="text-white text-2xl" />
                </div>
              </div>
              <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none transform group-hover:translate-y-1">
                Back to Assessments
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-8 border-transparent border-b-gray-900"></div>
              </div>
            </button>
            {questionsLoading ? (
              <Card className="shadow-xl animate-pulse">
                <CardContent className="py-16 sm:py-20 text-center">
                  <LoadingSpinner size="lg" color="blue" type="dots" />
                  <p className="mt-4 text-gray-600 font-semibold">Loading questions...</p>
                </CardContent>
              </Card>
            ) : questionsData.length > 0 ? (
              <>
                <div className="text-center mb-6 animate-fadeIn">
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
                    Question Review
                  </h2>
                  <p className="text-gray-600">Review all questions and your answers</p>
                </div>

                {questionsData.map((q, i) => (
                  <Card 
                    key={i} 
                    className="shadow-2xl border-2 border-gray-200 overflow-hidden transform transition-all duration-300 hover:shadow-3xl animate-slideInUp"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
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
                              <div key={k} className="bg-white border border-purple-200 p-3 rounded-lg text-gray-700 text-xs sm:text-sm transition-all hover:shadow-md">
                                <strong className="text-purple-600">{k}:</strong> {v}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 p-5 sm:p-6 rounded-xl text-center transform transition-all hover:scale-105">
                          <FaCheckCircle className="text-3xl sm:text-4xl text-green-600 mx-auto mb-2" />
                          <p className="font-bold text-green-900 text-sm sm:text-base">Correct Answer</p>
                          <p className="font-bold text-lg mt-2 text-green-700">
                            {q.type === 'true_false'
                              ? (q.correct_answer === true || q.correct_answer === 'true' ? 'True' : 'False')
                              : q.correct_answer || "N/A"
                            }
                          </p>
                        </div>

                        <div className={`border-2 p-5 sm:p-6 rounded-xl text-center transform transition-all hover:scale-105 ${
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
                          <p className={`text-lg font-bold mt-2 ${q.is_correct ? "text-green-600" : "text-red-600"}`}>
                            {q.type === 'true_false'
                              ? (q.student_answer === true || q.student_answer === 'true' ? 'True' : 'False')
                              : q.student_answer || "Not Answered"
                            }
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Floating Back Arrow */}
                <button
                  onClick={() => {
                    setShowType(null);
                    setTimeout(() => {
                      assessmentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                  }}
                  className="fixed left-1/2 -translate-x-1/2 top-24 z-40 group animate-fadeIn"
                  aria-label="Back to assessments"
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full blur-xl opacity-40 group-hover:opacity-60 transition-opacity"></div>
                    <div className="relative bg-gradient-to-r from-indigo-600 to-purple-600 p-4 rounded-full shadow-2xl transform transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1">
                      <FaArrowUp className="text-white text-2xl" />
                    </div>
                  </div>
                  <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none transform group-hover:translate-y-1">
                    Back to Assessments
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-8 border-transparent border-b-gray-900"></div>
                  </div>
                </button>
              </>
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

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-50 p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full shadow-2xl hover:shadow-indigo-500/50 transform hover:scale-110 transition-all duration-300 animate-fadeIn"
          aria-label="Scroll to top"
        >
          <FaArrowUp className="text-xl" />
        </button>
      )}

      <Footer />

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out;
        }

        .animate-slideInUp {
          animation: slideInUp 0.6s ease-out;
        }

        .animate-slideInLeft {
          animation: slideInLeft 0.6s ease-out;
        }

        .animate-slideInRight {
          animation: slideInRight 0.6s ease-out;
        }

        .scroll-mt-24 {
          scroll-margin-top: 6rem;
        }
      `}</style>
    </div>
  );
};

export default StudentAnalytics;