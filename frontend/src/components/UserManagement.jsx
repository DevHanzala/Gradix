import { useCallback, useEffect, useId, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { FaChalkboardTeacher, FaCrown, FaSearch, FaTrash, FaUserGraduate, FaUserShield, FaUsers } from "react-icons/fa";
import useAuthStore from "../store/authStore.js";
import { assignableRoles, canDeleteUser } from "../utils/rolePermissions.js";
import { errorMessage } from "../utils/forms.js";
import { formatDate, formatNumber } from "../utils/format.js";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Modal, PageHeader, ResponsiveTable, SkeletonList, StatCard } from "./ui";

const ROLE_TONE = { student: "success", instructor: "primary", admin: "warning", super_admin: "danger" };
const ROLE_ICON = { student: FaUserGraduate, instructor: FaChalkboardTeacher, admin: FaUserShield, super_admin: FaCrown };

function RoleControl({ requester, target, busy, onChange }) {
  const { t } = useTranslation();
  const options = assignableRoles(requester, target);
  const [value, setValue] = useState("");
  // The table renders each row twice (desktop table + mobile card), so ids must be per instance.
  const selectId = useId();

  if (options.length === 0) {
    return <span className="text-sm text-ink-subtle">{requester.id === target.id ? t("users.thisIsYou") : t("users.noActions")}</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor={selectId}>
        {t("users.newRoleFor", { name: target.name })}
      </label>
      <select
        id={selectId}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={busy}
        className="min-h-11 rounded-control border border-line-strong bg-surface px-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200"
      >
        <option value="">{t("users.changeRole")}</option>
        {options.map((role) => (
          <option key={role} value={role}>
            {t(`roles.${role}`)}
          </option>
        ))}
      </select>
      <Button
        variant="secondary"
        disabled={!value}
        loading={busy}
        onClick={() => {
          onChange(target, value);
          setValue("");
        }}
      >
        {t("common.apply")}
      </Button>
    </div>
  );
}

/**
 * User list with role management for admins and super admins. Which actions
 * appear depends on the viewer's role (utils/rolePermissions mirrors the API).
 */
function UserManagement({ title, subtitle }) {
  const { t } = useTranslation();
  const { user: requester, getUsers, changeUserRole, deleteUser } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await getUsers();
      setUsers(response.users || []);
    } catch (error) {
      setLoadError(errorMessage(error, t("users.loadFailed")));
    } finally {
      setLoading(false);
    }
  }, [getUsers, t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (target, newRole) => {
    setBusyId(target.id);
    try {
      await changeUserRole({ userId: target.id, newRole });
      toast.success(t("users.roleChanged", { name: target.name, role: t(`roles.${newRole}`) }));
      await fetchUsers();
    } catch (error) {
      toast.error(errorMessage(error, t("users.roleChangeFailed")));
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    const target = pendingDelete;
    setBusyId(target.id);
    try {
      await deleteUser(target.id);
      toast.success(t("users.deleted", { name: target.name }));
      await fetchUsers();
    } catch (error) {
      toast.error(errorMessage(error, t("users.deleteFailed")));
    } finally {
      setBusyId(null);
    }
  };

  const counts = useMemo(() => {
    const result = { student: 0, instructor: 0, admin: 0, super_admin: 0 };
    for (const u of users) result[u.role] = (result[u.role] || 0) + 1;
    return result;
  }, [users]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }, [users, query]);

  const columns = [
    {
      key: "name",
      header: t("users.user"),
      primary: true,
      render: (u) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{u.name}</p>
          <p className="truncate text-sm font-normal text-ink-subtle" dir="ltr">
            {u.email}
          </p>
        </div>
      ),
    },
    {
      key: "role",
      header: t("profile.role"),
      render: (u) => (
        <Badge tone={ROLE_TONE[u.role]} icon={ROLE_ICON[u.role]}>
          {t(`roles.${u.role}`)}
        </Badge>
      ),
    },
    {
      key: "verified",
      header: t("users.status"),
      render: (u) => (u.verified ? <Badge tone="success">{t("users.verified")}</Badge> : <Badge>{t("users.unverified")}</Badge>),
    },
    {
      key: "created_at",
      header: t("users.joined"),
      render: (u) => formatDate(u.created_at),
    },
  ];

  return (
    <>
      <PageHeader title={title} description={subtitle} />

      <section aria-label={t("users.counts")} className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Object.entries(counts).map(([role, count]) => (
          <StatCard key={role} label={t(`users.plural.${role}`)} value={loading ? "–" : formatNumber(count)} icon={ROLE_ICON[role]} />
        ))}
      </section>

      <Card>
        <CardHeader
          title={t("nav.users")}
          actions={
            <div className="relative w-full sm:w-72">
              <FaSearch className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
              <label htmlFor="user-search" className="sr-only">
                {t("users.search")}
              </label>
              <input
                id="user-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("users.searchPlaceholder")}
                className="min-h-11 w-full rounded-control border border-line-strong ps-9 pe-3 text-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
            </div>
          }
        />

        {loading ? (
          <SkeletonList rows={5} />
        ) : loadError ? (
          <div className="p-4 sm:p-6">
            <Alert
              tone="danger"
              title={t("users.loadFailedTitle")}
              action={
                <Button variant="secondary" onClick={fetchUsers}>
                  {t("common.tryAgain")}
                </Button>
              }
            >
              {loadError}
            </Alert>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={FaUsers} title={users.length ? t("users.noMatch") : t("users.none")} />
        ) : (
          <ResponsiveTable
            breakpoint="lg"
            caption={t("nav.users")}
            columns={columns}
            rows={filtered}
            actions={(u) => (
              <>
                <RoleControl requester={requester} target={u} busy={busyId === u.id} onChange={handleRoleChange} />
                {canDeleteUser(requester, u) && (
                  <Button
                    variant="ghost"
                    icon={FaTrash}
                    className="text-danger-700 hover:bg-danger-50"
                    onClick={() => setPendingDelete(u)}
                    disabled={busyId === u.id}
                  >
                    {t("common.delete")}
                  </Button>
                )}
              </>
            )}
          />
        )}
      </Card>

      <Modal
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        type="warning"
        title={pendingDelete ? t("users.deleteTitle", { name: pendingDelete.name }) : ""}
        onConfirm={confirmDelete}
        confirmText={t("users.deleteConfirm")}
        confirmVariant="danger"
      >
        {t("users.deleteBody")}
      </Modal>
    </>
  );
}

export default UserManagement;
