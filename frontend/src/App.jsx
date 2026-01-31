import { useEffect, lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import "./App.css";

/* =======================
   EAGER (NO LAYOUT)
   ======================= */
import Login from "./Pages/Login";
import Signup from "./Pages/Signup";
import Home from "./Pages/Home";

/* =======================
   LAZY LOAD
   ======================= */
const ResetPassword = lazy(() => import("./Pages/ResetPassword"));
const SetNewPassword = lazy(() => import("./Pages/SetNewPassword"));
const VerifyEmail = lazy(() => import("./Pages/VerifyEmail"));
const Profile = lazy(() => import("./Pages/Profile"));
const NotFound = lazy(() => import("./Pages/NotFound"));

/* Admin */
const AdminDashboard = lazy(() =>
  import("./Pages/Admin/AdminDashboard")
);

/* Super Admin */
const SuperAdminDashboard = lazy(() =>
  import("./Pages/SuperAdmin/SuperAdminDashboard")
);

/* Instructor */
const InstructorDashboard = lazy(() =>
  import("./Pages/Instructor/InstructorDashborad")
);
const CreateAssessment = lazy(() =>
  import("./Pages/Instructor/AssessmentManagement/CreateAssessment")
);
const ResourceManagement = lazy(() =>
  import("./Pages/Instructor/AssessmentManagement/ResourceManagement")
);
const AssessmentList = lazy(() =>
  import("./Pages/Instructor/AssessmentManagement/AssessmentList")
);
const AssessmentDetail = lazy(() =>
  import("./Pages/Instructor/AssessmentManagement/AssessmentDetail")
);
const EditAssessment = lazy(() =>
  import("./Pages/Instructor/AssessmentManagement/EditAssessment")
);
const EnrollStudents = lazy(() =>
  import("./Pages/Instructor/AssessmentManagement/EnrollStudents")
);
const AddStudent = lazy(() =>
  import("./Pages/Instructor/AddStudent")
);
const AssessmentAnalytics = lazy(() =>
  import("./Pages/Instructor/AssessmentManagement/AssessmentAnalytics")
);
const AssessmentPreview = lazy(() =>
  import("./Pages/Instructor/AssessmentManagement/AssessmentPreview")
);

/* Student */
const StudentDashboard = lazy(() =>
  import("./Pages/Student/StudentDashborad")
);
const TakeAssessment = lazy(() =>
  import("./Pages/Student/AssesmentManagement/TakeAssessment")
);
const StudentAnalytics = lazy(() =>
  import("./Pages/Student/StudentAnalytics")
);

/* Shared */
const ProtectedRoute = lazy(() =>
  import("./components/ProtectedRoutes")
);

/* Layouts */
import MainLayout from "./layouts/MainLayout";
import ExamLayout from "./layouts/ExamLayout";

/* =======================
   LOADING
   ======================= */
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      <p className="mt-4 text-gray-600">Loading...</p>
    </div>
  </div>
);

/* =======================
   SCROLL TO TOP
   ======================= */
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

/* =======================
   APP
   ======================= */
function App() {
  return (
    <Router>
      <ScrollToTop />

      <Suspense fallback={<LoadingFallback />}>
        <Routes>

          {/* PUBLIC – NO NAVBAR */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ResetPassword />} />
          <Route path="/reset-password/:resetId" element={<SetNewPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* HOME – WITH NAVBAR */}
          <Route
            path="/"
            element={
              <MainLayout>
                <Home />
              </MainLayout>
            }
          />

          {/* PROFILE */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Profile />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          {/* SUPER ADMIN */}
          <Route
            path="/super-admin/dashboard"
            element={
              <ProtectedRoute requiredRole="super_admin">
                <MainLayout>
                  <SuperAdminDashboard />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          {/* ADMIN */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute requiredRole="admin">
                <MainLayout>
                  <AdminDashboard />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          {/* INSTRUCTOR */}
          <Route
            path="/instructor/dashboard"
            element={
              <ProtectedRoute requiredRole="instructor">
                <MainLayout>
                  <InstructorDashboard />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          {[
            ["/instructor/resources", ResourceManagement],
            ["/instructor/assessments", AssessmentList],
            ["/instructor/assessments/create", CreateAssessment],
            ["/instructor/assessments/:id", AssessmentDetail],
            ["/instructor/assessments/:id/edit", EditAssessment],
            ["/instructor/assessments/:assessmentId/enroll", EnrollStudents],
            ["/instructor/assessments/:assessmentId/resources", ResourceManagement],
            ["/instructor/assessments/:assessmentId/analytics", AssessmentAnalytics],
            ["/instructor/assessments/:id/preview", AssessmentPreview],
            ["/instructor/students", AddStudent],
          ].map(([path, Component]) => (
            <Route
              key={path}
              path={path}
              element={
                <ProtectedRoute requiredRole="instructor">
                  <MainLayout>
                    <Component />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
          ))}

          {/* STUDENT */}
          <Route
            path="/student/dashboard"
            element={
              <ProtectedRoute requiredRole="student">
                <MainLayout>
                  <StudentDashboard />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/analytics"
            element={
              <ProtectedRoute requiredRole="student">
                <MainLayout>
                  <StudentAnalytics />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          {/* EXAM MODE – NO NAVBAR */}
          <Route
            path="/student/assessments/:assessmentId/take"
            element={
              <ProtectedRoute requiredRole="student">
                <ExamLayout>
                  <TakeAssessment />
                </ExamLayout>
              </ProtectedRoute>
            }
          />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>

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
    </Router>
  );
}

export default App;
