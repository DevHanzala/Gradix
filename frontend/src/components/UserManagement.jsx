import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FaSearch, FaTrash, FaUsers } from "react-icons/fa";
import useAuthStore from "../store/authStore.js";
import LoadingSpinner from "./ui/LoadingSpinner.jsx";
import { ROLE_LABELS, assignableRoles, canDeleteUser } from "../utils/rolePermissions.js";

const ROLE_BADGE = {
  student: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  instructor: "bg-blue-50 text-blue-700 ring-blue-200",
  admin: "bg-amber-50 text-amber-800 ring-amber-200",
  super_admin: "bg-purple-50 text-purple-700 ring-purple-200",
};

function RoleControl({ requester, target, busy, onChange }) {
  const options = assignableRoles(requester, target);
  const [value, setValue] = useState("");

  if (options.length === 0) {
    return <span className="text-xs text-gray-400">{requester.id === target.id ? "You" : "No actions"}</span>;
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
        className="min-h-11 rounded-lg border border-gray-300 bg-white px-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
      >
        <option value="">Change role…</option>
        {options.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn-secondary"
        disabled={!value || busy}
        onClick={() => {
          onChange(target, value);
          setValue("");
        }}
      >
        {busy ? <LoadingSpinner size="sm" /> : "Apply"}
      </button>
    </div>
  );
}

/**
 * User list with role management. Shown to admins and super admins; which
 * actions appear depends on the viewer's role (see utils/rolePermissions).
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
      setLoadError(error?.message || "Failed to load users.");
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
      toast.error(error?.message || "Could not change role.");
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    setBusyId(target.id);
    try {
      await deleteUser(target.id);
      toast.success(`${target.name} was deleted.`);
      await fetchUsers();
    } catch (error) {
      toast.error(error?.message || "Could not delete user.");
    } finally {
      setBusyId(null);
    }
  };

  const counts = useMemo(
    () =>
      users.reduce(
        (acc, u) => {
          acc[u.role] = (acc[u.role] || 0) + 1;
          return acc;
        },
        { student: 0, instructor: 0, admin: 0, super_admin: 0 }
      ),
    [users]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }, [users, query]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-gray-600">{subtitle}</p>}
      </header>

      <section aria-label="User counts" className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Object.entries(counts).map(([role, count]) => (
          <div key={role} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm text-gray-500">{ROLE_LABELS[role]}s</p>
            <p className="text-2xl font-bold text-gray-900">{loading ? "–" : count}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <FaUsers aria-hidden="true" /> Users
          </h2>
          <div className="relative w-full sm:w-72">
            <FaSearch className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <label htmlFor="user-search" className="sr-only">
              Search users
            </label>
            <input
              id="user-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or email"
              className="min-h-11 w-full rounded-lg border border-gray-300 ps-9 pe-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : loadError ? (
          <div className="p-10 text-center">
            <p className="font-semibold text-red-700">{loadError}</p>
            <button type="button" className="btn-secondary mt-4" onClick={fetchUsers}>
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-10 text-center text-gray-500">No users match your search.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map((u) => (
              <li key={u.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-gray-900">{u.name}</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${ROLE_BADGE[u.role] || ""}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                    {!u.verified && (
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">Unverified</span>
                    )}
                  </div>
                  <p className="truncate text-sm text-gray-500">{u.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <RoleControl requester={requester} target={u} busy={busyId === u.id} onChange={handleRoleChange} />
                  {canDeleteUser(requester, u) && (
                    <button
                      type="button"
                      onClick={() => setPendingDelete(u)}
                      disabled={busyId === u.id}
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-200"
                    >
                      <FaTrash aria-hidden="true" /> Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-6 sm:rounded-2xl">
            <h2 id="delete-title" className="text-lg font-bold text-gray-900">
              Delete {pendingDelete.name}?
            </h2>
            <p className="mt-2 text-gray-600">This permanently removes the account and its data. This cannot be undone.</p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" className="btn-secondary" onClick={() => setPendingDelete(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700"
                onClick={confirmDelete}
              >
                Delete account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
