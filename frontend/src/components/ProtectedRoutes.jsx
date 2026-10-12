import { Navigate, useLocation } from "react-router-dom";
import useAuthStore from "../store/authStore.js";

/**
 * Guards a route by authentication and role.
 * - Not logged in → /login (remembering where the user wanted to go).
 * - Logged in without an allowed role → /forbidden.
 * The backend enforces the same rules; this only keeps the UI consistent.
 *
 * @param {string[]} [allowedRoles] roles allowed to see the page; omit for "any logged-in user"
 */
function ProtectedRoute({ allowedRoles, children }) {
  const { token, user } = useAuthStore();
  const location = useLocation();

  if (!token || !user?.role) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/forbidden" replace />;
  }

  return children;
}

export default ProtectedRoute;
