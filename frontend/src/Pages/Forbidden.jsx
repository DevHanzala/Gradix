import { Link } from "react-router-dom";
import { FaLock } from "react-icons/fa";
import useAuthStore from "../store/authStore.js";
import { dashboardPathForRole } from "../utils/redirectByRole.js";

function Forbidden() {
  const { user } = useAuthStore();

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
          <FaLock className="text-2xl" aria-hidden="true" />
        </span>
        <p className="mt-6 text-sm font-semibold text-red-600">403</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">You don’t have access to this page</h1>
        <p className="mt-2 text-gray-600">
          This page is not available for your role{user?.role ? ` (${user.role.replace("_", " ")})` : ""}.
        </p>
        <Link to={dashboardPathForRole(user?.role)} className="btn-primary mt-8">
          Go to my dashboard
        </Link>
      </div>
    </div>
  );
}

export default Forbidden;
