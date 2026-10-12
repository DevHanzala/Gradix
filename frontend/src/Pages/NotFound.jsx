import { FaCompass } from "react-icons/fa";
import useAuthStore from "../store/authStore.js";
import { dashboardPathForRole } from "../utils/redirectByRole.js";
import { Button, EmptyState } from "../components/ui";

function NotFound() {
  const { user } = useAuthStore();
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md rounded-card bg-surface shadow-card">
        <EmptyState
          icon={FaCompass}
          title="Page not found"
          description="The page you are looking for does not exist or has moved."
          action={<Button to={user ? dashboardPathForRole(user.role) : "/"}>{user ? "Go to my dashboard" : "Go to home"}</Button>}
        />
      </div>
    </div>
  );
}

export default NotFound;
