import { Navigate } from "react-router-dom"
import useAuthStore from "../store/authStore.js" // Import the auth store

/**
 * A component that protects routes based on user authentication and role.
 * If the user is not authenticated, they are redirected to the login page.
 * If the user is authenticated but does not have an allowed role, they are redirected to the home page.
 * @param {Object} props - The component props.
 * @param {Array<string>} props.allowedRoles - An array of roles that are allowed to access this route (e.g., ['admin', 'instructor']).
 * @param {React.ReactNode} props.children - The child components to render if access is granted.
 */
function ProtectedRoute({ allowedRoles, children }) {
  const { token, user } = useAuthStore() // Get token and user from the auth store

  // If no token is present, the user is not authenticated
  if (!token) {
    return <Navigate to="/login" replace /> // Redirect to login page
  }

  // If user data is not loaded or role is missing (should ideally not happen if login is complete)
  if (!user || !user.role) {
    // This might indicate an incomplete login state or data issue, redirect to home or login
    return <Navigate to="/login" replace />
  }

  // Check if the user's role is included in the allowedRoles array
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // If the user's role is not allowed, redirect them to the home page
    // You could also redirect to a specific "unauthorized" page
    return <Navigate to="/" replace />
  }

  // If authenticated and authorized, render the child components
  return children
}

export default ProtectedRoute
