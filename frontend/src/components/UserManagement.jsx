import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FaChalkboardTeacher, FaCrown, FaSearch, FaTrash, FaUserGraduate, FaUserShield, FaUsers } from "react-icons/fa";
import useAuthStore from "../store/authStore.js";
import { ROLE_LABELS, assignableRoles, canDeleteUser } from "../utils/rolePermissions.js";
import { errorMessage } from "../utils/forms.js";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Modal, PageHeader, ResponsiveTable, SkeletonList, StatCard } from "./ui";

const ROLE_TONE = { student: "success", instructor: "primary", admin: "warning", super_admin: "danger" };
const ROLE_ICON = { student: FaUserGraduate, instructor: FaChalkboardTeacher, admin: FaUserShield, super_admin: FaCrown };

function RoleControl({ requester, target, busy, onChange }) {
  const options = assignableRoles(requester, target);
  const [value, setValue] = useState("");

  if (options.length === 0) {
    return <span className="text-sm text-ink-subtle">{requester.id === target.id ? "This is you" : "No actions"}</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor={`role-${target.id}`}>
        New role for {target.name}
      </label>
      <select
        id={`role-${target.id}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={busy}
        className="min-h-11 rounded-control border border-line-strong bg-surface px-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200"
      >
        <option value="">Change role…</option>
        {options.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
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
        Apply
      </Button>
    </div>
  );
}

/**
 * User list with role management for admins and super admins. Which actions
 * appear depends on the viewer's role (utils/rolePermissions mirrors the API).
 */
function UserManagement({ title, subtitle }) {
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
      setLoadError(errorMessage(error, "Failed to load users."));
    } finally {
      setLoading(false);
    }
  }, [getUsers]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (target, newRole) => {
    setBusyId(target.id);
    try {
      await changeUserRole({ userId: target.id, newRole });
      toast.success(`${target.name} is now ${ROLE_LABELS[newRole]}.`);
      await fetchUsers();
    } catch (error) {
      toast.error(errorMessage(error, "Could not change role."));
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    const target = pendingDelete;
    setBusyId(target.id);
    try {
      await deleteUser(target.id);
      toast.success(`${target.name} was deleted.`);
      await fetchUsers();
    } catch (error) {
      toast.error(errorMessage(error, "Could not delete user."));
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
      header: "User",
      primary: true,
      render: (u) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{u.name}</p>
          <p className="truncate text-sm font-normal text-ink-subtle">{u.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (u) => (
        <Badge tone={ROLE_TONE[u.role]} icon={ROLE_ICON[u.role]}>
          {ROLE_LABELS[u.role] || u.role}
        </Badge>
      ),
    },
    {
      key: "verified",
      header: "Status",
      render: (u) => (u.verified ? <Badge tone="success">Verified</Badge> : <Badge>Unverified</Badge>),
    },
    {
      key: "created_at",
      header: "Joined",
      render: (u) => (u.created_at ? new Date(u.created_at).toLocaleDateString() : "–"),
    },
  ];

  return (
    <>
      <PageHeader title={title} description={subtitle} />

      <section aria-label="User counts" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Object.entries(counts).map(([role, count]) => (
          <StatCard key={role} label={`${ROLE_LABELS[role]}s`} value={loading ? "–" : count} icon={ROLE_ICON[role]} />
        ))}
      </section>

      <Card>
        <CardHeader
          title="Users"
          actions={
            <div className="relative w-full sm:w-72">
              <FaSearch className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
              <label htmlFor="user-search" className="sr-only">
                Search users
              </label>
              <input
                id="user-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or email"
                className="min-h-11 w-full rounded-control border border-line-strong ps-9 pe-3 text-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
            </div>
          }
        />

        {loading ? (
          <SkeletonList rows={5} />
        ) : loadError ? (
          <div className="p-4 sm:p-6">
            <Alert tone="danger" title="Could not load users" action={<Button variant="secondary" onClick={fetchUsers}>Try again</Button>}>
              {loadError}
            </Alert>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={FaUsers} title={users.length ? "No users match your search" : "No users yet"} />
        ) : (
          <ResponsiveTable
            caption="Users"
            columns={columns}
            rows={filtered}
            actions={(u) => (
              <>
                <RoleControl requester={requester} target={u} busy={busyId === u.id} onChange={handleRoleChange} />
                {canDeleteUser(requester, u) && (
                  <Button variant="ghost" icon={FaTrash} className="text-danger-700 hover:bg-danger-50" onClick={() => setPendingDelete(u)} disabled={busyId === u.id}>
                    Delete
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
        title={pendingDelete ? `Delete ${pendingDelete.name}?` : ""}
        onConfirm={confirmDelete}
        confirmText="Delete account"
        confirmVariant="danger"
      >
        This permanently removes the account and its data. This cannot be undone.
      </Modal>
    </>
  );
}

export default UserManagement;
