// frontend/src/Pages/Student/StudentDashboard.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import useAuthStore from "../../store/authStore";
import useStudentAnalyticsStore from "../../store/useStudentAnalyticsStore";
import { Card, CardHeader, CardContent } from "../../components/ui/Card";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";

function StudentDashboard() {
  const { user } = useAuthStore();
  const { analytics, loading, fetchOverview } = useStudentAnalyticsStore();
  const [stats, setStats] = useState({
    totalAssessments: 0,
    completedAssessments: 0,
    pendingAssessments: 0,
  });

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    if (analytics) {
      const totalEnrolled = analytics.total_assessments || 0;
      const completed = analytics.completed_assessments || 0;
      const pending = Math.max(0, totalEnrolled - completed);

      setStats({
        totalAssessments: totalEnrolled,
        completedAssessments: completed,
        pendingAssessments: pending,
      });
    } else {
      setStats({
        totalAssessments: 0,
        completedAssessments: 0,
        pendingAssessments: 0,
      });
    }
  }, [analytics]);

  const getAssessmentStatus = (assessment) => {
    const completedAttempt = analytics.recent_performance?.find(a => a.assessment_id === assessment.id && a.date);
    if (completedAttempt) {
      return { status: "completed", color: "green", text: "Completed" };
    }
    return { status: "available", color: "blue", text: "Available" };
  };

  const formatDate = (dateString) => {
    if (!dateString) return "No deadline";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const calculateScorePercentage = (attempt) => {
    const obtainedMarks = attempt.obtained_marks || 0; // From assessment_attempts table
    const questions = attempt.questions || [];
    const totalMarks = Array.isArray(questions) ? questions.reduce((sum, q) => sum + (q.marks || 0), 0) : 0 || 1; // Fallback to 1 to avoid division by zero
    return totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 100) : 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Welcome back, {user?.name || "Student"}!</h1>
          <p className="text-lg text-gray-600 mt-2">Your personalized assessment overview</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardContent className="p-6 bg-gradient-to-br from-blue-100 to-blue-50 rounded-lg">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-blue-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-5">
                  <p className="text-sm font-medium text-gray-700">Total Assessments</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalAssessments}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardContent className="p-6 bg-gradient-to-br from-green-100 to-green-50 rounded-lg">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-green-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5">
                  <p className="text-sm font-medium text-gray-700">Completed</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.completedAssessments}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardContent className="p-6 bg-gradient-to-br from-yellow-100 to-yellow-50 rounded-lg">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-yellow-200 rounded-full flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-yellow-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-5">
                  <p className="text-sm font-medium text-gray-700">Pending</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.pendingAssessments}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-10">
          <Card className="shadow-lg">
            <CardContent className="p-6 bg-white rounded-lg">
              <div className="text-center">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Track Your Progress</h3>
                <p className="text-gray-600 mb-6">Get detailed insights into your performance and learning recommendations</p>
                <Link
                  to="/student/analytics"
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-300"
                >
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  View Analytics
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-r from-gray-100 to-gray-50 p-4 rounded-t-lg">
                <h2 className="text-xl font-semibold text-gray-900">Available Assessments</h2>
              </CardHeader>
              <CardContent className="p-6">
                {analytics?.enrolled_assessments?.length > 0 ? (
                  <div className="space-y-4">
                    {analytics.enrolled_assessments.map((assessment) => {
                      const status = getAssessmentStatus(assessment);
                      return (
                        <div
                          key={assessment.id}
                          className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all duration-200"
                        >
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">{assessment.title || "Untitled"}</h3>
                            {assessment.prompt && <p className="text-sm text-gray-600">{assessment.prompt}</p>}
                            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                              <span>📝 AI-Generated Questions</span>
                              <span>🤖 Auto-Graded</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                status.color === "blue"
                                  ? "bg-blue-100 text-blue-800"
                                  : status.color === "green"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {status.text}
                            </span>
                            {status.status === "available" && (
                              <Link
                                to={`/student/assessments/${assessment.id}/take`}
                                className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                              >
                                Start
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No assessments available</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-r from-gray-100 to-gray-50 p-4 rounded-t-lg">
                <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
              </CardHeader>
              <CardContent className="p-6">
                {analytics?.recent_performance?.length > 0 ? (
                  <div className="space-y-4">
                    {analytics.recent_performance
                      .slice(0, 5)
                      .map((attempt) => (
                        <div key={attempt.assessment_id} className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                              <svg
                                className="w-5 h-5 text-green-700"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{attempt.title || "Untitled"}</p>
                            <p className="text-xs text-gray-500">Completed on {formatDate(attempt.date)}</p>
                          </div>
                          <div className="text-sm font-medium text-green-600">{calculateScorePercentage(attempt)}%</div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No recent activity</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-10">
          <Card className="shadow-lg">
            <CardHeader className="bg-gradient-to-r from-gray-100 to-gray-50 p-4 rounded-t-lg">
              <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Link
                  to="/profile"
                  className="flex items-center p-5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:shadow-md transition-all duration-300"
                >
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-green-700"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5">
                    <p className="font-medium text-gray-900">Update Profile</p>
                    <p className="text-sm text-gray-600">Manage your account settings</p>
                  </div>
                </Link>

                <button
                  onClick={fetchOverview}
                  className="flex items-center p-5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:shadow-md transition-all duration-300"
                >
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-purple-700"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5">
                    <p className="font-medium text-gray-900">Refresh Data</p>
                    <p className="text-sm text-gray-600">Update your dashboard</p>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default StudentDashboard;