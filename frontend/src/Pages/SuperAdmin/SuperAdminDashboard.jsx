import { useTranslation } from "react-i18next";
import UserManagement from "../../components/UserManagement.jsx";
import PlatformStats from "../../components/PlatformStats.jsx";

function SuperAdminDashboard() {
  const { t } = useTranslation();
  return (
    <>
      <UserManagement title={t("users.superAdminTitle")} subtitle={t("users.superAdminSubtitle")} />
      <PlatformStats />
    </>
  );
}

export default SuperAdminDashboard;
