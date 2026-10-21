import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaBars, FaSignOutAlt, FaTimes } from "react-icons/fa";
import useAuthStore from "../store/authStore.js";
import { dashboardPathForRole } from "../utils/redirectByRole.js";
import LanguageSwitcher from "../components/LanguageSwitcher.jsx";
import { ACCOUNT_LINKS, BRAND, NAVIGATION } from "./navigation.js";

function Brand({ to }) {
  const Icon = BRAND.icon;
  return (
    <Link to={to} className="inline-flex min-h-11 items-center gap-2 rounded-control font-bold text-ink">
      <span className="flex h-8 w-8 items-center justify-center rounded-control bg-primary-600 text-white">
        <Icon aria-hidden="true" />
      </span>
      <span className="text-lg" lang="en">
        {BRAND.name}
      </span>
    </Link>
  );
}

function NavItems({ items, onNavigate }) {
  const { t } = useTranslation();
  return (
    <ul className="space-y-1">
      {items.map(({ to, labelKey, icon: Icon, end }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-medium transition ${
                isActive ? "bg-primary-50 text-primary-700" : "text-ink-muted hover:bg-gray-100 hover:text-ink"
              }`
            }
          >
            <Icon aria-hidden="true" className="shrink-0" />
            <span>{t(labelKey)}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

function SidebarContent({ user, onNavigate, onLogout }) {
  const { t } = useTranslation();
  const items = NAVIGATION[user.role] || [];
  return (
    <div className="flex h-full flex-col">
      <nav aria-label={t("nav.main")} className="flex-1 overflow-y-auto px-3 py-4">
        <NavItems items={items} onNavigate={onNavigate} />
        <p className="mt-6 px-3 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t("nav.account")}</p>
        <div className="mt-2">
          <NavItems items={ACCOUNT_LINKS} onNavigate={onNavigate} />
        </div>
      </nav>
      <div className="border-t border-line p-3">
        <div className="mb-2 px-3">
          <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
          <p className="truncate text-xs text-ink-subtle">{t(`roles.${user.role}`)}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-sm font-medium text-ink-muted hover:bg-gray-100 hover:text-ink"
        >
          <FaSignOutAlt aria-hidden="true" className="rtl:rotate-180" />
          {t("nav.logout")}
        </button>
      </div>
    </div>
  );
}

/**
 * Layout for signed-in users: sidebar on desktop (lg+), drawer behind a
 * hamburger on smaller screens, and a consistent top bar.
 */
function AppShell({ children, topBarExtras = null }) {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef(null);
  const menuButtonRef = useRef(null);

  // Close the drawer when the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Escape closes the drawer; focus moves into it while open.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const menuButton = menuButtonRef.current;
    drawerRef.current?.querySelector("a, button")?.focus();
    const onKey = (e) => e.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      menuButton?.focus();
    };
  }, [drawerOpen]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const home = dashboardPathForRole(user?.role);

  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-control bg-primary-600 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {t("nav.skipToContent")}
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col border-e border-line bg-surface lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-line px-5">
          <Brand to={home} />
        </div>
        <SidebarContent user={user} onLogout={handleLogout} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-gray-900/50" aria-hidden="true" onClick={() => setDrawerOpen(false)} />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.navigation")}
            className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-raised"
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
              <Brand to={home} />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-control text-ink-muted hover:bg-gray-100"
                aria-label={t("nav.closeNavigation")}
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>
            <SidebarContent user={user} onNavigate={() => setDrawerOpen(false)} onLogout={handleLogout} />
          </div>
        </div>
      )}

      <div className="lg:ps-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-line bg-surface/95 px-4 backdrop-blur sm:gap-3 sm:px-6">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-ink-muted hover:bg-gray-100 lg:hidden"
            aria-label={t("nav.openNavigation")}
            aria-expanded={drawerOpen}
          >
            <FaBars aria-hidden="true" />
          </button>
          <div className="hidden sm:block lg:hidden">
            <Brand to={home} />
          </div>
          <div className="ms-auto flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher compact />
            {topBarExtras}
            <div className="hidden text-end md:block">
              <p className="text-sm font-semibold text-ink">{user?.name}</p>
              <p className="text-xs text-ink-subtle">{t(`roles.${user?.role}`)}</p>
            </div>
            <Link
              to="/profile"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-200"
              aria-label={t("nav.profile")}
            >
              {(user?.name || "?").trim().charAt(0).toUpperCase()}
            </Link>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl px-4 py-6 focus:outline-none sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppShell;
