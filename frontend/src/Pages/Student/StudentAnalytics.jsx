import { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardContent } from "../../components/ui/Card";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import toast from "react-hot-toast";
import useStudentAnalyticsStore from "../../store/useStudentAnalyticsStore.js";
import { FaEye, FaBook } from "react-icons/fa";
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
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <LoadingSpinner size="lg" />
      </div>
    );

  if (error)
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600 text-xl font-medium">
        Error: {error}
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">My Analytics</h1>
        <p className="text-center text-gray-600 mb-8">Review your performance</p>

        {/* Assessment List */}
        <div className="space-y-6">
          {assessments.length > 0 ? (
            assessments.map((a) => (
              <Card
                key={a.id}
                className={`w-full shadow-md hover:shadow-lg transition rounded-xl border ${
                  selectedAssessment === a.id ? "border-indigo-500" : "border-transparent"
                }`}
              >
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white rounded-t-xl">
                  <h3 className="text-xl font-bold">{a.title}</h3>
                  <p className="text-sm opacity-90">
                    {new Date(a.date).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>

                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <p className="text-gray-600">Click to review your answers</p>

                    <div className="flex gap-3">
                      <button
                        onClick={() => handleSeeResults(a.id)}
                        className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition"
                      >
                        <FaEye className="inline mr-2" /> Results
                      </button>

                      <button
                        onClick={() => handleSeeQuestions(a.id)}
                        className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
                      >
                        <FaEye className="inline mr-2" /> Questions
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-20">
              <FaBook className="mx-auto text-7xl text-gray-300 mb-4" />
              <p className="text-xl text-gray-500">No assessments completed yet</p>
            </div>
          )}
        </div>

        {/* Results View */}
        {showType === "results" && selectedAssessmentDetails && (
          <div ref={resultsRef} className="mt-10 space-y-6">
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-center py-6">
                <h2 className="text-2xl font-bold">{selectedAssessmentDetails.assessment_title}</h2>
              </CardHeader>

              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                  <div className="p-6 bg-green-500 text-white rounded-xl shadow-md">
                    <p className="text-4xl font-bold">{selectedAssessmentDetails.score}%</p>
                    <p className="text-lg mt-2">Score</p>
                  </div>

                  <div className="p-6 bg-blue-500 text-white rounded-xl shadow-md">
                    <p className="text-3xl font-bold">{formatTime(selectedAssessmentDetails.time_taken)}</p>
                    <p className="text-lg mt-2">Time</p>
                  </div>

                  <div className="p-6 bg-purple-500 text-white rounded-xl shadow-md">
                    <p className="text-3xl font-bold">
                      {selectedAssessmentDetails.correct_answers} / {selectedAssessmentDetails.total_questions}
                    </p>
                    <p className="text-lg mt-2">Correct</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="text-center">
              <button
                onClick={() => downloadReport(selectedAssessment)}
                className="px-10 py-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition"
              >
                Download Full Report (PDF)
              </button>
            </div>
          </div>
        )}

        {/* Questions View */}
        {showType === "questions" && (
          <div className="mt-12 space-y-8">
            {questionsLoading ? (
              <Card><CardContent className="py-16 text-center"><LoadingSpinner size="lg" /></CardContent></Card>
            ) : questionsData.length > 0 ? (
              questionsData.map((q, i) => (
                <Card key={i} className="shadow-xl overflow-hidden">
                  <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white p-4">
                    <h3 className="text-xl font-bold">
                      Question {q.question_order || i + 1} ({q.type})
                    </h3>
                  </div>
                  <CardContent className="p-6 space-y-6">
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <p className="font-bold text-gray-800 mb-2">Question:</p>
                      <p className="text-base text-gray-700 leading-relaxed">{q.question}</p>
                    </div>

                    {/* Only show options for MCQ */}
                    {q.type === "MCQ" && q.options && (
                      <div className="bg-blue-50 p-4 rounded-xl">
                        <p className="font-bold text-blue-800 mb-2">Options</p>
                        <div className="space-y-2">
                          {Object.entries(q.options).map(([k, v]) => (
                            <div key={k} className="bg-white p-3 rounded-lg text-gray-700 text-sm">
                              <strong>{k}:</strong> {v}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-green-50 p-4 rounded-xl text-center">
                        <p className="font-bold text-green-800">Correct Answer</p>
                        <p className="text-2xl font-bold text-green-600 mt-1">{q.correct_answer}</p>
                      </div>

                      <div className={`p-4 rounded-xl text-center ${q.is_correct ? "bg-green-100" : "bg-red-100"}`}>
                        <p className="font-bold">Your Answer</p>
                        <p className={`text-2xl font-bold mt-1 ${q.is_correct ? "text-green-600" : "text-red-600"}`}>
                          {q.student_answer || "Not Answered"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card><CardContent className="py-16 text-center text-gray-500 text-lg">No questions available</CardContent></Card>
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default StudentAnalytics;
