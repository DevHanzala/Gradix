import { useTranslation } from "react-i18next";
import UserManagement from "../../components/UserManagement.jsx";
import PlatformStats from "../../components/PlatformStats.jsx";
import PlansAdmin from "../../components/plans/PlansAdmin.jsx";
import FeedbackInbox from "../../components/plans/FeedbackInbox.jsx";

function SuperAdminDashboard() {
  const { t } = useTranslation();
  return (
    <>
      <UserManagement title={t("users.superAdminTitle")} subtitle={t("users.superAdminSubtitle")} />
      <PlatformStats />
      <PlansAdmin />
      <FeedbackInbox />
    </>
  );
}

export default SuperAdminDashboard;
