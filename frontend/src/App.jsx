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
const Forbidden = lazy(() => import("./Pages/Forbidden"));

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
  import("./Pages/Instructor/InstructorDashboard")
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
  import("./Pages/Student/StudentDashboard")
);
const TakeAssessment = lazy(() =>
  import("./Pages/Student/AssessmentManagement/TakeAssessment")
);
const StudentAnalytics = lazy(() =>
  import("./Pages/Student/StudentAnalytics")
);

/* Shared */
const ProtectedRoute = lazy(() =>
  import("./components/ProtectedRoutes")
);

const INSTRUCTOR_ROUTES = [
  { path: "/instructor/resources", page: ResourceManagement },
  { path: "/instructor/assessments", page: AssessmentList },
  { path: "/instructor/assessments/create", page: CreateAssessment },
  { path: "/instructor/assessments/:id", page: AssessmentDetail },
  { path: "/instructor/assessments/:id/edit", page: EditAssessment },
  { path: "/instructor/assessments/:assessmentId/enroll", page: EnrollStudents },
  { path: "/instructor/assessments/:assessmentId/resources", page: ResourceManagement },
  { path: "/instructor/assessments/:assessmentId/analytics", page: AssessmentAnalytics },
  { path: "/instructor/assessments/:id/preview", page: AssessmentPreview },
  { path: "/instructor/students", page: AddStudent },
];

/* Layouts */
import MainLayout from "./layouts/MainLayout";
import PublicLayout from "./layouts/PublicLayout";
import { PageSpinner } from "./components/ui/Spinner.jsx";
import ExamLayout from "./layouts/ExamLayout";

/* =======================
   LOADING
   ======================= */
const LoadingFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-canvas">
    <PageSpinner />
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
              <PublicLayout>
                <Home />
              </PublicLayout>
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
              <ProtectedRoute allowedRoles={["super_admin"]}>
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
              <ProtectedRoute allowedRoles={["admin"]}>
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
              <ProtectedRoute allowedRoles={["instructor"]}>
                <MainLayout>
                  <InstructorDashboard />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          {INSTRUCTOR_ROUTES.map((route) => {
            const Page = route.page;
            return (
              <Route
                key={route.path}
                path={route.path}
                element={
                  <ProtectedRoute allowedRoles={["instructor"]}>
                    <MainLayout>
                      <Page />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
            );
          })}

          {/* STUDENT */}
          <Route
            path="/student/dashboard"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
                <MainLayout>
                  <StudentDashboard />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/analytics"
            element={
              <ProtectedRoute allowedRoles={["student"]}>
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
              <ProtectedRoute allowedRoles={["student"]}>
                <ExamLayout>
                  <TakeAssessment />
                </ExamLayout>
              </ProtectedRoute>
            }
          />

          {/* 403 */}
          <Route
            path="/forbidden"
            element={
              <MainLayout>
                <Forbidden />
              </MainLayout>
            }
          />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>

      <Toaster
        position="top-center"
        toastOptions={{
          duration: 5000,
          className: "rounded-card! text-sm!",
          ariaProps: { role: "status", "aria-live": "polite" },
        }}
      />
    </Router>
  );
}

export default App;
