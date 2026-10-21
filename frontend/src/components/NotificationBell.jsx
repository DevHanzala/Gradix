import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaBell } from "react-icons/fa";
import { fetchNotificationsApi, markAllNotificationsReadApi, markNotificationReadApi } from "../api/notifications.api.js";
import useAuthStore from "../store/authStore.js";
import { formatDateTime, formatPercent } from "../utils/format.js";

const POLL_MS = 60000;

/** Where a notification leads (by type and the viewer's role). */
const linkFor = (n, role) => {
  const id = n.data?.assessmentId;
  if (n.type === "results_ready" && id) return `/student/results/${id}`;
  if ((n.type === "enrolled" || n.type === "published") && id && role === "student") return "/student/dashboard";
  if (n.type === "password_changed" || n.type === "role_changed") return "/profile";
  return null;
};

/**
 * Bell in the top bar: unread count, a panel with the latest notifications
 * (rendered in the reader's language from type + data), mark read.
 */
function NotificationBell() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const [data, setData] = useState({ items: [], unread: 0 });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchNotificationsApi();
      setData(res.data.data);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onClick = (e) => {
      if (!panelRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const text = (n) =>
    t(`notifications.types.${n.type}`, {
      ...n.data,
      oldRole: n.data?.oldRole ? t(`roles.${n.data.oldRole}`) : "",
      newRole: n.data?.newRole ? t(`roles.${n.data.newRole}`) : "",
      percentage: n.data?.percentage !== undefined ? formatPercent(n.data.percentage) : "",
    });

  const markRead = async (n) => {
    if (n.read_at) return;
    setData((d) => ({ items: d.items.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)), unread: Math.max(0, d.unread - 1) }));
    try {
      await markNotificationReadApi(n.id);
    } catch {
      load();
    }
  };

  const markAll = async () => {
    setData((d) => ({ items: d.items.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })), unread: 0 }));
    try {
      await markAllNotificationsReadApi();
    } catch {
      load();
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={data.unread ? t("notifications.labelUnread", { count: data.unread }) : t("notifications.label")}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-control text-ink-muted hover:bg-gray-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-200"
      >
        <FaBell aria-hidden="true" />
        {data.unread > 0 && (
          <span className="absolute end-1.5 top-1.5 min-w-5 rounded-full bg-danger-600 px-1 text-center text-[11px] font-bold leading-5 text-white" aria-hidden="true">
            {data.unread > 9 ? "9+" : data.unread}
          </span>
        )}
      </button>
      {open && (
        <div
          ref={panelRef}
          role="region"
          aria-label={t("notifications.label")}
          className="fixed inset-x-2 top-16 z-40 max-h-[70vh] overflow-y-auto rounded-card bg-surface shadow-raised ring-1 ring-line sm:absolute sm:inset-x-auto sm:end-0 sm:top-12 sm:w-96"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <p className="font-semibold text-ink">{t("notifications.label")}</p>
            {data.unread > 0 && (
              <button type="button" onClick={markAll} className="min-h-11 text-sm font-semibold text-primary-700 hover:underline">
                {t("notifications.markAll")}
              </button>
            )}
          </div>
          {error ? (
            <p className="p-4 text-sm text-danger-700">{t("notifications.loadFailed")}</p>
          ) : data.items.length === 0 ? (
            <p className="p-4 text-sm text-ink-muted">{t("notifications.none")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.items.map((n) => {
                const to = linkFor(n, role);
                const body = (
                  <>
                    <span className="flex items-start gap-2">
                      {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-600" aria-label={t("notifications.unread")} />}
                      <span className={`text-sm ${n.read_at ? "text-ink-muted" : "font-medium text-ink"}`}>{text(n)}</span>
                    </span>
                    <span className="mt-1 block text-xs text-ink-subtle">{formatDateTime(n.created_at)}</span>
                  </>
                );
                return (
                  <li key={n.id}>
                    {to ? (
                      <Link
                        to={to}
                        onClick={() => {
                          markRead(n);
                          setOpen(false);
                        }}
                        className="block px-4 py-3 hover:bg-gray-50"
                      >
                        {body}
                      </Link>
                    ) : (
                      <button type="button" onClick={() => markRead(n)} className="block w-full px-4 py-3 text-start hover:bg-gray-50">
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
