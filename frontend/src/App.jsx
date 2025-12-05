import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { Toaster } from "react-hot-toast";
import "./App.css";

// Auth Pages
import Login from "./Pages/Login";
import Signup from "./Pages/Signup";
import ResetPassword from "./Pages/ResetPassword";
import SetNewPassword from "./Pages/SetNewPassword";
import VerifyEmail from "./Pages/VerifyEmail";

// General Pages
import Home from "./Pages/Home";
import Profile from "./Pages/Profile";
import NotFound from "./Pages/NotFound";

// Admin Pages
import AdminDashboard from "./Pages/Admin/AdminDashboard";

// Super Admin Pages
import SuperAdminDashboard from "./Pages/SuperAdmin/SuperAdminDashboard";

// Instructor Pages
import InstructorDashboard from "./Pages/Instructor/InstructorDashborad";
import CreateAssessment from "./Pages/Instructor/AssessmentManagement/CreateAssessment";
import ResourceManagement from "./Pages/Instructor/AssessmentManagement/ResourceManagement";
import AssessmentList from "./Pages/Instructor/AssessmentManagement/AssessmentList";
import AssessmentDetail from "./Pages/Instructor/AssessmentManagement/AssessmentDetail";
import EditAssessment from "./Pages/Instructor/AssessmentManagement/EditAssessment";
import EnrollStudents from "./Pages/Instructor/AssessmentManagement/EnrollStudents";
import AddStudent from "./Pages/Instructor/AddStudent";
import AssessmentAnalytics from "./Pages/Instructor/AssessmentManagement/AssessmentAnalytics";

// Student Pages
import StudentDashboard from "./Pages/Student/StudentDashborad";
import TakeAssessment from "./Pages/Student/AssesmentManagement/TakeAssessment";
import StudentAnalytics from "./Pages/Student/StudentAnalytics";

import ProtectedRoute from "./components/ProtectedRoutes";
import { handleGoogleRedirect } from "./config/handleRedirect";

function App() {
  // MUST run before Router loads to ensure Google Redirect authentication works reliably
  useEffect(() => {
    handleGoogleRedirect();
  }, []);

  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ResetPassword />} />
          <Route path="/reset-password/:resetId" element={<SetNewPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* Profile (authenticated only, no role restriction) */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          {/* Super Admin Routes */}
          <Route
            path="/super-admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={["super_admin"]}>
                <SuperAdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Admin Routes */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Instructor Routes */}
          <Route
            path="/instructor/dashboard"
            element={
              <ProtectedRoute allowedRoles={["instructor"]}>
                <InstructorDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/instructor/resources"
            element={
              <ProtectedRoute allowedRoles={["instructor"]}>
                <ResourceManagement />
              </ProtectedRoute>
            }
          />

          <Route
            path="/instructor/assessments"
            element={
              <ProtectedRoute allowedRoles={["instructor"]}>
                <AssessmentList />
              </ProtectedRoute>
            }
          />

          <Route
            path="/instructor/assessments/create"
            element={
              <ProtectedRoute allowedRoles={["instructor"]}>
                <CreateAssessment />
              </ProtectedRoute>
            }
          />

          <Route
            path="/instructor/assessments/:id"
            element={
              <ProtectedRoute allowedRoles={["instructor"]}>
                <AssessmentDetail />
              </ProtectedRoute>
            }
          />

          <Route
            path="/instructor/assessments/:id/edit"
            element={
              <ProtectedRoute allowedRoles={["instructor"]}>
                <EditAssessment />
              </ProtectedRoute>
            }
          />

          <Route
            path="/instructor/assessments/:assessmentId/enroll"
            element={
              <ProtectedRoute allowedRoles={["instructor"]}>
                <EnrollStudents />
              </ProtectedRoute>
            }
          />

          <Route
            path="/instructor/assessments/:assessmentId/resources"
            element={
              <ProtectedRoute allowedRoles={["instructor"]}>
                <ResourceManagement />
              </ProtectedRoute>
            }
          />

          <Route
            path="/instructor/assessments/:assessmentId/analytics"
            element={
              <ProtectedRoute allowedRoles={["instructor"]}>
                <AssessmentAnalytics />
              </ProtectedRoute>
            }
          />

          <Route
            path="/instructor/students"
            element={
              <ProtectedRoute allowedRoles={["instructor"]}>
                <AddStudent />
              </ProtectedRoute>
            }
          />

          {/* Student Routes */}
          <Route
            path="/student/dashboard"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/analytics"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <StudentAnalytics />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/assessments/:assessmentId/take"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <TakeAssessment />
              </ProtectedRoute>
            }
          />

          {/* Catch-all Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>

        {/* Toast Notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#363636",
              color: "#fff",
            },
            success: {
              duration: 3000,
              theme: {
                primary: "green",
                secondary: "black",
              },
            },
          }}
        />
      </div>
    </Router>
  );
}

export default App;
