import { FaCompass } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import useAuthStore from "../store/authStore.js";
import { dashboardPathForRole } from "../utils/redirectByRole.js";
import { Button, EmptyState } from "../components/ui";

function NotFound() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md rounded-card bg-surface shadow-card">
        <EmptyState
          icon={FaCompass}
          title={t("errors.notFound.title")}
          description={t("errors.notFound.body")}
          action={<Button to={user ? dashboardPathForRole(user.role) : "/"}>{user ? t("nav.goToMyDashboard") : t("common.goHome")}</Button>}
        />
      </div>
    </div>
  );
}

export default NotFound;
