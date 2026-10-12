import { FaLock } from "react-icons/fa";
import useAuthStore from "../store/authStore.js";
import { dashboardPathForRole } from "../utils/redirectByRole.js";
import { ROLE_LABELS } from "../utils/rolePermissions.js";
import { Button, Card, EmptyState } from "../components/ui";

/** 403: shown when a signed-in user opens a page their role cannot use. */
function Forbidden() {
  const { user } = useAuthStore();
  return (
    <Card className="mx-auto max-w-lg">
      <EmptyState
        icon={FaLock}
        title="You don’t have access to this page"
        description={`This page is not available for your role${user?.role ? ` (${ROLE_LABELS[user.role]})` : ""}.`}
        action={<Button to={dashboardPathForRole(user?.role)}>Go to my dashboard</Button>}
      />
    </Card>
  );
}

export default Forbidden;
