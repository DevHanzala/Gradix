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
      const pending = Math.max(0, completed - totalEnrolled);

      setStats({
        totalAssessments: totalEnrolled,
        completedAssessments: completed,
        pendingAssessments: pending,
      });
    }
  }, [analytics]);

  const getAssessmentStatus = (assessment) => {
    const completedAttempt = analytics.recent_performance?.find(a => a.assessment_id === assessment.id);
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

      <div className="w-full mx-auto px-4 sm:px-4 lg:px-8 xl:px-10 py-10">
        {/* Welcome Header */}
        <div className="mb-10 text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
            Welcome back, {user?.name || "Student"}!
          </h1>
          <p className="text-lg text-gray-600 mt-2">Your personalized assessment dashboard</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
          <Card className="shadow-xl hover:shadow-2xl transition-shadow duration-300">
            <CardContent className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Total Assessments</p>
                  <p className="text-4xl font-bold mt-2">{stats.completedAssessments}</p>
                </div>
                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xl hover:shadow-2xl transition-shadow duration-300">
            <CardContent className="p-6 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium">Completed</p>
                  <p className="text-4xl font-bold mt-2">{stats.totalAssessments}</p>
                </div>
                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xl hover:shadow-2xl transition-shadow duration-300">
            <CardContent className="p-6 bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-100 text-sm font-medium">Pending</p>
                  <p className="text-4xl font-bold mt-2">{stats.pendingAssessments}</p>
                </div>
                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analytics CTA */}
        <div className="mb-10">
          <Card className="shadow-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
            <CardContent className="p-10 text-center">
              <h3 className="text-2xl font-bold mb-4">Track Your Progress</h3>
              <p className="text-purple-100 mb-8 max-w-2xl mx-auto">
                View detailed performance analytics, strengths, weaknesses, and improvement recommendations
              </p>
              <Link
                to="/student/analytics"
                className="inline-flex items  items-center px-8 py-4 bg-white text-purple-700 font-bold rounded-xl hover:bg-gray Hod-100 transition shadow-lg text-lg"
              >
                View Detailed Analytics
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          {/* Available Assessments */}
          <Card className="shadow-xl">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
              <h2 className="text-2xl font-bold text-gray-900">Available Assessments</h2>
            </CardHeader>
            <CardContent className="p-6">
              {analytics?.enrolled_assessments?.length > 0 ? (
                <div className="space-y-4">
                  {analytics.enrolled_assessments.map((assessment) => {
                    const status = getAssessmentStatus(assessment);
                    return (
                      <div
                        key={assessment.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-gray-50 rounded-xl border border-gray-200 hover:shadow-md transition"
                      >
                        <div className="mb-4 sm:mb-0">
                          <h3 className="font-bold text-lg text-gray-900">{assessment.title || "Untitled"}</h3>
                          {assessment.prompt && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{assessment.prompt}</p>
                          )}
                          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                            <span>AI-Generated</span>
                            <span>Auto-Graded</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                              status.status === "completed"
                                ? "bg-green-100 text-green-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {status.text}
                          </span>
                          {status.status === "available" && (
                            <Link
                              to={`/student/assessments/${assessment.id}/take`}
                              className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
                            >
                              Start Now
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">No assessments available yet</p>
                  <p className="text-sm mt-2">Check back later for new assessments!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="shadow-xl">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-xl">
              <h2 className="text-2xl font-bold text-gray-900">Recent Activity</h2>
            </CardHeader>
            <CardContent className="p-6">
              {analytics?.recent_performance?.length > 0 ? (
                <div className="space-y-4">
                  {analytics.recent_performance.slice(0, 5).map((attempt) => (
                    <div key={attempt.assessment_id} className="flex items-center gap-4 p-4 bg-green-50 rounded-lg">
                      <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-7 h-7 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{attempt.title || "Untitled Assessment"}</p>
                        <p className="text-sm text-gray-600">Completed on {formatDate(attempt.date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">No recent activity</p>
                  <p className="text-sm mt-2">Complete your first assessment to see it here!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="shadow-xl">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-t-xl">
            <h2 className="text-2xl font-bold text-gray-900">Quick Actions</h2>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Link
                to="/profile"
                className="flex items-center p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-purple-400 hover:shadow-lg transition-all"
              >
                <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-8 h-8 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="ml-5">
                  <p className="font-bold text-gray-900">Update Profile</p>
                  <p className="text-sm text-gray-600">Manage your personal information</p>
                </div>
              </Link>

              <button
                onClick={fetchOverview}
                className="flex items-center p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-indigo-400 hover:shadow-lg transition-all"
              >
                <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-8 h-8 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div className="ml-5">
                  <p className="font-bold text-gray-900">Refresh Dashboard</p>
                  <p className="text-sm text-gray-600">Update with latest data</p>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
}

export default StudentDashboard;