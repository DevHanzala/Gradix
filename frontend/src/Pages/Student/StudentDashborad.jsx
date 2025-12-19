import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import useAuthStore from "../../store/authStore";
import useStudentAnalyticsStore from "../../store/useStudentAnalyticsStore";
import { Card, CardHeader, CardContent } from "../../components/ui/Card";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { 
  FaClipboardList, 
  FaCheckCircle, 
  FaClock, 
  FaChartLine, 
  FaUser, 
  FaSync,
  FaPlayCircle,
  FaTrophy,
  FaCalendarAlt,
  FaBook,
  FaGraduationCap
} from "react-icons/fa";

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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner type="bars" />
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const statsData = [
    {
      value: stats.totalAssessments,
      label: "Total Assessments",
      icon: <FaClipboardList className="w-8 h-8" />,
      gradient: "from-blue-500 to-blue-600",
      lightColor: "text-blue-100",
      bgOpacity: "bg-white/20"
    },
    {
      value: stats.completedAssessments,
      label: "Completed",
      icon: <FaCheckCircle className="w-8 h-8" />,
      gradient: "from-green-500 to-green-600",
      lightColor: "text-green-100",
      bgOpacity: "bg-white/20"
    },
    {
      value: stats.pendingAssessments,
      label: "Pending",
      icon: <FaClock className="w-8 h-8" />,
      gradient: "from-amber-500 to-orange-600",
      lightColor: "text-amber-100",
      bgOpacity: "bg-white/20"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
      <Navbar />

      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        {/* Welcome Header - Enhanced */}
        <div className="mb-8 sm:mb-10">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl sm:rounded-3xl p-6 sm:p-8 lg:p-10 shadow-2xl text-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 sm:mb-3 flex items-center gap-3">
                  <FaGraduationCap className="text-yellow-300" />
                  Welcome back, {user?.name || "Student"}! 🎓
                </h1>
                <p className="text-blue-100 text-sm sm:text-base lg:text-lg">
                  Your personalized learning dashboard - track progress, complete assessments, and achieve excellence.
                </p>
              </div>
              <div className="hidden sm:block">
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 lg:p-6">
                  <FaTrophy className="w-10 h-10 lg:w-12 lg:h-12 mx-auto mb-2 text-yellow-300" />
                  <p className="text-xs lg:text-sm font-semibold text-center">
                    Keep Going!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards - Enhanced */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-10">
          {statsData.map((stat, index) => (
            <Card key={index} className="shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border-2 border-gray-200">
              <CardContent className={`p-6 bg-gradient-to-br ${stat.gradient} text-white rounded-xl`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`${stat.lightColor} text-sm font-semibold mb-2`}>{stat.label}</p>
                    <p className="text-3xl sm:text-4xl font-bold">{stat.value}</p>
                  </div>
                  <div className={`w-14 h-14 sm:w-16 sm:h-16 ${stat.bgOpacity} rounded-full flex items-center justify-center backdrop-blur-sm shadow-lg`}>
                    {stat.icon}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Analytics CTA - Enhanced */}
        <div className="mb-8 sm:mb-10">
          <Card className="shadow-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 text-white border-2 border-purple-700 overflow-hidden relative">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-40"></div>
            <CardContent className="relative p-6 sm:p-8 lg:p-10 text-center">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-semibold mb-4">
                <FaChartLine />
                Performance Insights
              </div>
              <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-4">Track Your Progress</h3>
              <p className="text-purple-100 text-sm sm:text-base mb-6 sm:mb-8 max-w-2xl mx-auto">
                View detailed performance analytics, strengths, weaknesses, and personalized improvement recommendations
              </p>
              <Link
                to="/student/analytics"
                className="inline-flex items-center gap-3 px-6 sm:px-8 py-3 sm:py-4 bg-white text-purple-700 font-bold rounded-xl hover:bg-gray-100 transition-all shadow-2xl hover:shadow-white/30 text-base sm:text-lg transform hover:-translate-y-1"
              >
                <FaChartLine />
                View Detailed Analytics
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid - Enhanced */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-8 sm:mb-10">
          {/* Available Assessments - Enhanced */}
          <Card className="shadow-2xl border-2 border-gray-200">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <FaBook className="text-blue-600" />
                Available Assessments
              </h2>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {analytics?.enrolled_assessments?.length > 0 ? (
                <div className="space-y-4">
                  {analytics.enrolled_assessments.map((assessment) => {
                    const status = getAssessmentStatus(assessment);
                    return (
                      <div
                        key={assessment.id}
                        className="flex flex-col p-4 bg-white rounded-xl border-2 border-gray-200 hover:shadow-lg hover:border-blue-300 transition-all"
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            status.status === "completed" 
                              ? "bg-green-100 text-green-600" 
                              : "bg-blue-100 text-blue-600"
                          }`}>
                            {status.status === "completed" ? <FaCheckCircle /> : <FaClipboardList />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-base sm:text-lg text-gray-900 mb-1">
                              {assessment.title || "Untitled"}
                            </h3>
                            {assessment.prompt && (
                              <p className="text-xs sm:text-sm text-gray-600 line-clamp-2 mb-2">
                                {assessment.prompt}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                              <span className="inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full">
                                <FaCheckCircle className="text-blue-500" />
                                AI-Generated
                              </span>
                              <span className="inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full">
                                <FaCheckCircle className="text-green-500" />
                                Auto-Graded
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-200">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${
                              status.status === "completed"
                                ? "bg-green-100 text-green-800 border-green-200"
                                : "bg-blue-100 text-blue-800 border-blue-200"
                            }`}
                          >
                            {status.status === "completed" ? <FaCheckCircle /> : <FaClock />}
                            {status.text}
                          </span>
                          {status.status === "available" && (
                            <Link
                              to={`/student/assessments/${assessment.id}/take`}
                              className="inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg text-xs sm:text-sm"
                            >
                              <FaPlayCircle />
                              Start
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 sm:py-16">
                  <div className="bg-gradient-to-br from-blue-100 to-purple-100 w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FaBook className="text-3xl sm:text-4xl text-blue-600" />
                  </div>
                  <p className="text-base sm:text-lg font-semibold text-gray-700 mb-2">No assessments available yet</p>
                  <p className="text-sm text-gray-500">Check back later for new assessments!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity - Enhanced */}
          <Card className="shadow-2xl border-2 border-gray-200">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b-2 border-green-200">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <FaCheckCircle className="text-green-600" />
                Recent Activity
              </h2>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {analytics?.recent_performance?.length > 0 ? (
                <div className="space-y-4">
                  {analytics.recent_performance.slice(0, 5).map((attempt) => (
                    <div 
                      key={attempt.assessment_id} 
                      className="flex items-center gap-4 p-4 bg-white rounded-xl border-2 border-green-200 hover:shadow-lg transition-all"
                    >
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                        <FaCheckCircle className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm sm:text-base text-gray-900 mb-1">
                          {attempt.title || "Untitled Assessment"}
                        </p>
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                          <FaCalendarAlt className="text-gray-400" />
                          <span>Completed on {formatDate(attempt.date)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 sm:py-16">
                  <div className="bg-gradient-to-br from-green-100 to-emerald-100 w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FaCheckCircle className="text-3xl sm:text-4xl text-green-600" />
                  </div>
                  <p className="text-base sm:text-lg font-semibold text-gray-700 mb-2">No recent activity</p>
                  <p className="text-sm text-gray-500">Complete your first assessment to see it here!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions - Enhanced */}
        <Card className="shadow-2xl border-2 border-gray-200">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b-2 border-purple-200">
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FaTrophy className="text-purple-600" />
              Quick Actions
            </h2>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <Link
                to="/profile"
                className="flex items-center p-5 sm:p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-purple-400 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                  <FaUser className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <div className="ml-4 sm:ml-5">
                  <p className="font-bold text-base sm:text-lg text-gray-900 mb-1">Update Profile</p>
                  <p className="text-xs sm:text-sm text-gray-600">Manage your personal information</p>
                </div>
              </Link>

              <button
                onClick={fetchOverview}
                className="flex items-center p-5 sm:p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-indigo-400 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                  <FaSync className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <div className="ml-4 sm:ml-5">
                  <p className="font-bold text-base sm:text-lg text-gray-900 mb-1">Refresh Dashboard</p>
                  <p className="text-xs sm:text-sm text-gray-600">Update with latest data</p>
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