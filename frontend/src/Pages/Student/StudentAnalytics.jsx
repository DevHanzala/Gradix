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

  const [showType, setShowType] = useState(null); // 'results' or 'questions' or null
  const [questionsData, setQuestionsData] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  useEffect(() => {
    if (selectedAssessment && showType === 'results') {
      fetchAssessmentDetails(selectedAssessment).then(() => {
        console.log("Selected Assessment Details:", selectedAssessmentDetails);
      }).catch(err => console.error("Error fetching details:", err));
    }
  }, [selectedAssessment, showType, fetchAssessmentDetails]);

  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds <= 0) return "0m 0s";
    seconds = Math.floor(seconds);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const handleSeeResults = (assessmentId) => {
    setSelectedAssessment(assessmentId);
    setShowType('results');
    setQuestionsData([]); // Clear questions if switching
  };

  const handleSeeQuestions = async (assessmentId) => {
    setSelectedAssessment(assessmentId);
    setShowType('questions');
    setQuestionsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const API_URL = import.meta.env.VITE_API_URL || "https://gradeadmin.techmiresolutions.com/api";
      const response = await axios.get(`${API_URL}/student-analytics/assessment/${assessmentId}/questions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setQuestionsData(response.data.data);
      } else {
        throw new Error(response.data.message || "Failed to fetch questions");
      }
    } catch (error) {
      toast.error(error.message || "Failed to fetch questions and answers");
    } finally {
      setQuestionsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <p className="text-red-500 text-lg">Error loading analytics: {error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center mb-6">
          <div className="text-3xl">📚</div>
          <span className="text-2xl font-bold text-blue-600 ml-2">Gradewise AI</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Analytics</h1>
        <p className="text-gray-600">Track your progress and identify areas for improvement</p>

        <div className="mt-6">
          <Card className="shadow-lg bg-white rounded-xl">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-t-xl">
              <h3 className="text-lg font-semibold">My Assessments <FaChartLine className="inline ml-2" /></h3>
            </CardHeader>
            <CardContent>
              {assessments.length > 0 ? (
                <div className="space-y-4">
                  {assessments.map((assessment) => (
                    <div
                      key={assessment.id}
                      className={`p-4 border rounded-lg transition-all ${selectedAssessment === assessment.id ? 'bg-blue-50 border-blue-500' : ''}`}
                    >
                      <div>
                        <p className="font-medium text-gray-900">{assessment.title}</p>
                        <p className="text-sm text-gray-600">Date: {new Date(assessment.date).toLocaleDateString()}</p>
                      </div>
                      <div className="flex mt-2">
                        <button
                          onClick={() => handleSeeResults(assessment.id)}
                          className="flex-1 px-3 py-1 bg-green-500 text-white rounded-l hover:bg-green-600 flex items-center justify-center"
                        >
                          <FaEye className="mr-1" /> See Results
                        </button>
                        <button
                          onClick={() => handleSeeQuestions(assessment.id)}
                          className="flex-1 px-3 py-1 bg-blue-500 text-white rounded-r hover:bg-blue-600 flex items-center justify-center"
                        >
                          <FaEye className="mr-1" /> See Questions
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No assessments completed yet <FaBook className="inline" /></p>
              )}
            </CardContent>
          </Card>

          {selectedAssessment && selectedAssessmentDetails && showType === 'results' && (
            <div className="mt-8 space-y-6">
              <Card className="shadow-lg bg-white rounded-xl">
                <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-t-xl">
                  <h3 className="text-lg font-semibold">Assessment Details <FaBook className="inline ml-2" /></h3>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="flex items-center">
                      <FaBook className="text-blue-500 mr-2" />
                      <p className="text-sm font-medium text-gray-600">Title</p>
                      <p className="text-lg font-medium text-gray-900 ml-2">{selectedAssessmentDetails.assessment_title || 'N/A'}</p>
                    </div>
                    <div className="flex items-center">
                      <FaCheck className="text-green-500 mr-2" />
                      <p className="text-sm font-medium text-gray-600">Score</p>
                      <p className="text-3xl font-bold text-gray-900 ml-2">{selectedAssessmentDetails.score || 0}%</p>
                    </div>
                    <div className="flex items-center">
                      <FaClock className="text-yellow-500 mr-2" />
                      <p className="text-sm font-medium text-gray-600">Time Taken</p>
                      <p className="text-lg font-medium text-gray-900 ml-2">{formatTime(selectedAssessmentDetails.time_taken || 0)}</p>
                    </div>
                    <div className="flex items-center">
                      <FaChartLine className="text-purple-500 mr-2" />
                      <p className="text-sm font-medium text-gray-600">Total Questions</p>
                      <p className="text-lg font-medium text-gray-900 ml-2">
                        {selectedAssessmentDetails.total_questions || 0}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <FaCheck className="text-green-500 mr-2" />
                      <p className="text-sm font-medium text-gray-600">Correct Answers</p>
                      <p className="text-lg font-medium text-gray-900 ml-2">
                        {selectedAssessmentDetails.correct_answers || 0}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <FaTimes className="text-red-500 mr-2" />
                      <p className="text-sm font-medium text-gray-600">Incorrect Answers</p>
                      <p className="text-lg font-medium text-gray-900 ml-2">
                        {selectedAssessmentDetails.incorrect_answers || 0}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <FaTimes className="text-red-500 mr-2" />
                      <p className="text-sm font-medium text-gray-600">Negative Marks Applied</p>
                      <p className="text-lg font-medium text-gray-900 ml-2">
                        {selectedAssessmentDetails.negative_marks_applied ? `-${selectedAssessmentDetails.negative_marks_applied}` : 0}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <FaChartLine className="text-purple-500 mr-2" />
                      <p className="text-sm font-medium text-gray-600">Total Marks</p>
                      <p className="text-lg font-medium text-gray-900 ml-2">
                        {selectedAssessmentDetails.total_marks || 0}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <FaCheck className="text-green-500 mr-2" />
                      <p className="text-sm font-medium text-gray-600">Obtained Marks</p>
                      <p className="text-lg font-medium text-gray-900 ml-2">
                        {selectedAssessmentDetails.student_score || 0}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <FaClock className="text-yellow-500 mr-2" />
                      <p className="text-sm font-medium text-gray-600">Created At</p>
                      <p className="text-lg font-medium text-gray-900 ml-2">
                        {new Date(selectedAssessmentDetails.assessment_created_at).toLocaleString() || 'N/A'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-lg bg-white rounded-xl">
                <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-t-xl">
                  <h3 className="text-lg font-semibold">Learning Recommendations <FaChartLine className="inline ml-2" /></h3>
                </CardHeader>
                <CardContent>
                  {selectedAssessmentDetails.recommendations ? (
                    <>
                      <h4 className="text-md font-semibold text-gray-700">Areas of Improvement</h4>
                      {selectedAssessmentDetails.recommendations.weak_areas && selectedAssessmentDetails.recommendations.weak_areas.length > 0 ? (
                        <ul className="list-disc pl-5 space-y-2">
                          {selectedAssessmentDetails.recommendations.weak_areas.map((area, index) => (
                            <li key={index} className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                              <strong>{area.topic}:</strong> Performance {area.performance}%, Suggestion: {area.suggestion}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-500 text-center py-2">No specific weak areas identified.</p>
                      )}
                      <h4 className="text-md font-semibold text-gray-700 mt-4">Study Plan</h4>
                      {selectedAssessmentDetails.recommendations.study_plan ? (
                        <div className="mt-2">
                          <h5 className="text-sm font-medium text-gray-600">Daily Practice <FaClock className="inline ml-1" /></h5>
                          <ul className="list-disc pl-5 space-y-2">
                            {selectedAssessmentDetails.recommendations.study_plan.daily_practice.map((item, index) => (
                              <li key={index} className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                                {item.topic}: {item.focus} ({item.time_allocation || 'N/A'})
                              </li>
                            ))}
                          </ul>
                          <h5 className="text-sm font-medium text-gray-600 mt-2">Weekly Review <FaChartLine className="inline ml-1" /></h5>
                          <ul className="list-disc pl-5 space-y-2">
                            {selectedAssessmentDetails.recommendations.study_plan.weekly_review.map((item, index) => (
                              <li key={index} className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                                {item.topic}: {item.activity} - {item.goal || 'N/A'}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-gray-500 text-center py-2">No study plan available.</p>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-500 text-center py-4">Loading recommendations...</p>
                  )}
                </CardContent>
              </Card>

              <div className="text-center">
                <button
                  onClick={() => downloadReport(selectedAssessment)}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all flex items-center justify-center"
                >
                  <FaBook className="mr-2" /> Download Assessment Report
                </button>
              </div>
            </div>
          )}

          {selectedAssessment && showType === 'questions' && (
            <div className="mt-8 space-y-6">
              <Card className="shadow-lg bg-white rounded-xl">
                <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-t-xl">
                  <h3 className="text-lg font-semibold">Questions and Answers</h3>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {questionsLoading ? (
                      <p className="text-gray-500 text-center py-4">Loading questions...</p>
                    ) : questionsData.length > 0 ? (
                      questionsData.map((q, index) => (
                        <div key={index} className="border border-gray-200 p-6 rounded-xl bg-gradient-to-br from-white to-gray-50 shadow-md hover:shadow-lg transition-all duration-300">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-4 bg-white rounded-lg">
                              <p className="text-xl font-semibold text-gray-800 mb-2">Question {q.question_order || (index + 1)} ({q.type})</p>
                              <p className="text-gray-700 leading-relaxed">{q.question}</p>
                            </div>
                            <div className="p-4 bg-white rounded-lg">
                              <p className="text-lg font-medium text-gray-800 mb-2">Options</p>
                              <p className="text-gray-600 leading-relaxed">
                                {q.options ? (
                                  <ul className="list-disc list-inside space-y-1">
                                    {Object.entries(q.options).map(([key, value]) => (
                                      <li key={key} className="text-gray-700">{`${key}: ${value}`}</li>
                                    ))}
                                  </ul>
                                ) : <span className="text-gray-500 italic">N/A</span>}
                              </p>
                            </div>
                            <div className="p-4 bg-white rounded-lg">
                              <p className="text-lg font-medium text-gray-800 mb-2">Correct Answer</p>
                              <p className="text-green-600 font-medium leading-relaxed">{q.correct_answer || 'N/A'}</p>
                            </div>
                            <div className="p-4 bg-white rounded-lg">
                              <p className="text-lg font-medium text-gray-800 mb-2">Your Answer</p>
                              <p className="text-blue-600 font-medium leading-relaxed">{q.student_answer || 'N/A'}</p>
                            </div>
                            <div className="p-4 bg-white rounded-lg">
                              <p className="text-lg font-medium text-gray-800 mb-2">Score</p>
                              <p className="text-purple-600 font-medium leading-relaxed">
                                {q.score < 0 ? `-${Math.abs(q.score)}` : q.score}/{q.max_marks}
                              </p>
                            </div>
                            <div className="p-4 bg-white rounded-lg">
                              <p className="text-lg font-medium text-gray-800 mb-2">Correct?</p>
                              <p className="text-gray-700 leading-relaxed">{q.is_correct ? 'Yes' : 'No'}</p>
                            </div>
                            <div className="p-4 bg-white rounded-lg">
                              <p className="text-lg font-medium text-gray-800 mb-2">Negative Marks</p>
                              <p className="text-red-600 font-medium leading-relaxed">{q.negative_marks ? `-${q.negative_marks}` : 0}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-center py-4">No questions available.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default StudentAnalytics;