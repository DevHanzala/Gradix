import { useTranslation } from "react-i18next";
import UserManagement from "../../components/UserManagement.jsx";

function AdminDashboard() {
  const { t } = useTranslation();
  return <UserManagement title={t("users.adminTitle")} subtitle={t("users.adminSubtitle")} />;
}

export default AdminDashboard;
