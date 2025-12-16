import { useEffect, lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import "./App.css";

// Eager load critical components (auth pages for fast initial load)
import Login from "./Pages/Login";
import Signup from "./Pages/Signup";
import Home from "./Pages/Home";

// Lazy load all other components
const ResetPassword = lazy(() => import("./Pages/ResetPassword"));
const SetNewPassword = lazy(() => import("./Pages/SetNewPassword"));
const VerifyEmail = lazy(() => import("./Pages/VerifyEmail"));
const Profile = lazy(() => import("./Pages/Profile"));
const NotFound = lazy(() => import("./Pages/NotFound"));

// Admin Pages
const AdminDashboard = lazy(() => import("./Pages/Admin/AdminDashboard"));

// Super Admin Pages
const SuperAdminDashboard = lazy(() => import("./Pages/SuperAdmin/SuperAdminDashboard"));

// Instructor Pages
const InstructorDashboard = lazy(() => import("./Pages/Instructor/InstructorDashborad"));
const CreateAssessment = lazy(() => import("./Pages/Instructor/AssessmentManagement/CreateAssessment"));
const ResourceManagement = lazy(() => import("./Pages/Instructor/AssessmentManagement/ResourceManagement"));
const AssessmentList = lazy(() => import("./Pages/Instructor/AssessmentManagement/AssessmentList"));
const AssessmentDetail = lazy(() => import("./Pages/Instructor/AssessmentManagement/AssessmentDetail"));
const EditAssessment = lazy(() => import("./Pages/Instructor/AssessmentManagement/EditAssessment"));
const EnrollStudents = lazy(() => import("./Pages/Instructor/AssessmentManagement/EnrollStudents"));
const AddStudent = lazy(() => import("./Pages/Instructor/AddStudent"));
const AssessmentAnalytics = lazy(() => import("./Pages/Instructor/AssessmentManagement/AssessmentAnalytics"));

// Student Pages
const StudentDashboard = lazy(() => import("./Pages/Student/StudentDashborad"));
const TakeAssessment = lazy(() => import("./Pages/Student/AssesmentManagement/TakeAssessment"));
const StudentAnalytics = lazy(() => import("./Pages/Student/StudentAnalytics"));

const ProtectedRoute = lazy(() => import("./components/ProtectedRoutes"));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      <p className="mt-4 text-gray-600">Loading...</p>
    </div>
  </div>
);

// SCROLL TO TOP ON EVERY ROUTE CHANGE
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function App() {
  return (
    <Router>
      <ScrollToTop /> {/* This fixes "start from top" on every navigation */}
      <div className="App min-h-screen bg-gray-50">
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ResetPassword />} />
            <Route path="/reset-password/:resetId" element={<SetNewPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />

            {/* Protected Routes */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            {/* Super Admin */}
            <Route
              path="/super-admin/dashboard"
              element={
                <ProtectedRoute requiredRole="super_admin">
                  <SuperAdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Admin */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Instructor */}
            <Route
              path="/instructor/dashboard"
              element={
                <ProtectedRoute requiredRole="instructor">
                  <InstructorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/instructor/resources"
              element={
                <ProtectedRoute requiredRole="instructor">
                  <ResourceManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/instructor/assessments"
              element={
                <ProtectedRoute requiredRole="instructor">
                  <AssessmentList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/instructor/assessments/create"
              element={
                <ProtectedRoute requiredRole="instructor">
                  <CreateAssessment />
                </ProtectedRoute>
              }
            />
            <Route
              path="/instructor/assessments/:id"
              element={
                <ProtectedRoute requiredRole="instructor">
                  <AssessmentDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/instructor/assessments/:id/edit"
              element={
                <ProtectedRoute requiredRole="instructor">
                  <EditAssessment />
                </ProtectedRoute>
              }
            />
            <Route
              path="/instructor/assessments/:assessmentId/enroll"
              element={
                <ProtectedRoute requiredRole="instructor">
                  <EnrollStudents />
                </ProtectedRoute>
              }
            />
            <Route
              path="/instructor/assessments/:assessmentId/resources"
              element={
                <ProtectedRoute requiredRole="instructor">
                  <ResourceManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/instructor/assessments/:assessmentId/analytics"
              element={
                <ProtectedRoute requiredRole="instructor">
                  <AssessmentAnalytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/instructor/students"
              element={
                <ProtectedRoute requiredRole="instructor">
                  <AddStudent />
                </ProtectedRoute>
              }
            />

            {/* Student */}
            <Route
              path="/student/dashboard"
              element={
                <ProtectedRoute requiredRole="student">
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/analytics"
              element={
                <ProtectedRoute requiredRole="student">
                  <StudentAnalytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/assessments/:assessmentId/take"
              element={
                <ProtectedRoute requiredRole="student">
                  <TakeAssessment />
                </ProtectedRoute>
              }
            />

            {/* 404 - Must be last */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>

        {/* Toast */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#1f2937",
              color: "#fff",
              borderRadius: "12px",
              padding: "16px",
            },
          }}
        />
      </div>
    </Router>
  );
}

export default App;