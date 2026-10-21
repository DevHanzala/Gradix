import { FaLock } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import useAuthStore from "../store/authStore.js";
import { dashboardPathForRole } from "../utils/redirectByRole.js";
import { Button, Card, EmptyState } from "../components/ui";

/** 403: shown when a signed-in user opens a page their role cannot use. */
function Forbidden() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  return (
    <Card className="mx-auto max-w-lg">
      <EmptyState
        icon={FaLock}
        title={t("errors.forbidden.title")}
        description={user?.role ? t("errors.forbidden.bodyRole", { role: t(`roles.${user.role}`) }) : t("errors.forbidden.body")}
        action={<Button to={dashboardPathForRole(user?.role)}>{t("nav.goToMyDashboard")}</Button>}
      />
    </Card>
  );
}

export default Forbidden;
