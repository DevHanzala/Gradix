import { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "../../components/ui/Card";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import toast from "react-hot-toast";
import useStudentAnalyticsStore from "../../store/useStudentAnalyticsStore.js";
import { FaCheck, FaTimes, FaClock, FaBook, FaChartLine, FaEye } from "react-icons/fa";
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

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  useEffect(() => {
    if (selectedAssessment && showType === "results") {
      fetchAssessmentDetails(selectedAssessment);
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

  if (loading) return <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center"><LoadingSpinner size="lg" /></div>;
  if (error) return <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center text-red-600 text-xl font-medium">Error: {error}</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Navbar />
      <div className="w-full  mx-auto px-4 sm:px-6 lg:px-8 py-10">

        <h1 className="text-4xl font-extrabold text-center text-gray-900 mb-3">My Analytics</h1>
        <p className="text-center text-lg text-gray-600 mb-12">Review your performance in detail</p>

        {/* ASSESSMENT LIST — FULL WIDTH ON DESKTOP */}
        <div className="space-y-8">
          {assessments.length > 0 ? assessments.map((a) => (
            <Card
              key={a.id}
              className={`w-full shadow-2xl hover:shadow-3xl transition-all duration-300 overflow-hidden rounded-2xl border-2 ${
                selectedAssessment === a.id ? "border-indigo-500 ring-4 ring-indigo-200 ring-opacity-50" : "border-transparent"
              }`}
            >
              <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-6 text-white">
                <h3 className="text-2xl font-bold">{a.title}</h3>
                <p className="text-sm opacity-90 mt-1">
                  {new Date(a.date).toLocaleDateString("en-US", {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>

              <CardContent className="p-6 bg-white">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                  <div className="flex-1">
                    <p className="text-gray-600">Click below to review your answers and performance</p>
                  </div>

                  {/* Buttons — Always perfect, never cut off */}
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleSeeResults(a.id)}
                      className="flex-1 sm:flex-initial px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-700 transition shadow-lg flex items-center justify-center text-lg"
                    >
                      <FaEye className="mr-2" /> Results
                    </button>
                    <button
                      onClick={() => handleSeeQuestions(a.id)}
                      className="flex-1 sm:flex-initial px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-600 hover:to-indigo-700 transition shadow-lg flex items-center justify-center text-lg"
                    >
                      <FaEye className="mr-2" /> Questions
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )) : (
            <div className="text-center py-20">
              <FaBook className="mx-auto text-8xl text-gray-300 mb-6" />
              <p className="text-2xl text-gray-500">No assessments completed yet</p>
            </div>
          )}
        </div>

        {/* RESULTS VIEW */}
        {showType === "results" && selectedAssessmentDetails && (
          <div className="mt-12 space-y-8">
            <Card className="shadow-2xl">
              <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-center py-10">
                <h2 className="text-4xl font-extrabold">{selectedAssessmentDetails.assessment_title}</h2>
              </CardHeader>
              <CardContent className="p-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                  <div className="p-8 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-3xl shadow-xl">
                    <p className="text-6xl font-bold">{selectedAssessmentDetails.score}%</p>
                    <p className="text-xl mt-3">Your Score</p>
                  </div>
                  <div className="p-8 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-3xl shadow-xl">
                    <p className="text-5xl font-bold">{formatTime(selectedAssessmentDetails.time_taken)}</p>
                    <p className="text-xl mt-3">Time Taken</p>
                  </div>
                  <div className="p-8 bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-3xl shadow-xl">
                    <p className="text-5xl font-bold">
                      {selectedAssessmentDetails.correct_answers} / {selectedAssessmentDetails.total_questions}
                    </p>
                    <p className="text-xl mt-3">Correct Answers</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="text-center">
              <button
                onClick={() => downloadReport(selectedAssessment)}
                className="px-12 py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xl font-bold rounded-2xl hover:shadow-2xl transition transform hover:scale-105"
              >
                Download Full Report (PDF)
              </button>
            </div>
          </div>
        )}

        {/* QUESTIONS VIEW — MOBILE SAFE */}
        {showType === "questions" && (
          <div className="mt-12 space-y-10">
            {questionsLoading ? (
              <Card><CardContent className="py-20 text-center"><LoadingSpinner size="lg" /></CardContent></Card>
            ) : questionsData.length > 0 ? (
              questionsData.map((q, i) => (
                <Card key={i} className="shadow-2xl overflow-hidden">
                  <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white p-6">
                    <h3 className="text-2xl font-bold">
                      Question {q.question_order || i + 1} ({q.type || "MCQ"})
                    </h3>
                  </div>
                  <CardContent className="p-8 space-y-8">
                    <div className="bg-gray-50 p-6 rounded-2xl">
                      <p className="text-xl font-bold text-gray-800 mb-3">Question:</p>
                      <p className="text-lg text-gray-700 leading-relaxed">{q.question}</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="space-y-5">
                        <div className="bg-blue-50 p-6 rounded-2xl">
                          <p className="font-bold text-blue-800 mb-3">Options</p>
                          <div className="space-y-3">
                            {q.options && Object.entries(q.options).map(([k, v]) => (
                              <div key={k} className="bg-white p-4 rounded-xl text-gray-700">
                                <strong>{k}:</strong> {v}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="bg-green-50 p-6 rounded-2xl text-center">
                          <p className="font-bold text-green-800">Correct Answer</p>
                          <p className="text-3xl font-bold text-green-600 mt-2">{q.correct_answer}</p>
                        </div>
                        <div className={`p-6 rounded-2xl text-center ${q.is_correct ? "bg-green-100" : "bg-red-100"}`}>
                          <p className="font-bold">Your Answer</p>
                          <p className={`text-3xl font-bold mt-2 ${q.is_correct ? "text-green-600" : "text-red-600"}`}>
                            {q.student_answer || "Not Answered"}
                          </p>
                        </div>

                        <div className="flex flex-wrap justify-center gap-4">
                          <div className="bg-purple-100 text-purple-800 px-8 py-4 rounded-full font-bold text-xl">
                            Score: {q.score}/{q.max_marks}
                          </div>
                          {q.negative_marks > 0 && (
                            <div className="bg-red-100 text-red-800 px-8 py-4 rounded-full font-bold text-xl">
                              Penalty: -{q.negative_marks}
                            </div>
                          )}
                          <div className={`px-8 py-4 rounded-full font-bold text-xl ${q.is_correct ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                            {q.is_correct ? "Correct" : "Incorrect"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card><CardContent className="text-center py-20 text-gray-500 text-xl">No questions available</CardContent></Card>
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default StudentAnalytics;