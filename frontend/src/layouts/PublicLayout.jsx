import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import useAuthStore from "../store/authStore.js";
import { dashboardPathForRole } from "../utils/redirectByRole.js";
import { BRAND } from "./navigation.js";
import Button from "../components/ui/Button.jsx";
import LanguageSwitcher from "../components/LanguageSwitcher.jsx";

export function RecaptchaNotice({ className = "" }) {
  return (
    <p className={`text-xs text-ink-subtle ${className}`}>
      <Trans
        i18nKey="common.recaptchaNotice"
        components={{
          privacy: <a className="underline hover:text-ink" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" />,
          terms: <a className="underline hover:text-ink" href="https://policies.google.com/terms" target="_blank" rel="noreferrer" />,
        }}
      />
    </p>
  );
}

/** Layout for public pages (home, 404 for visitors). */
function PublicLayout({ children }) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const Icon = BRAND.icon;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="flex min-h-16 w-full flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex min-h-11 items-center gap-2 font-bold text-ink">
            <span className="flex h-8 w-8 items-center justify-center rounded-control bg-primary-600 text-white">
              <Icon aria-hidden="true" />
            </span>
            <span className="text-lg" lang="en">
              {BRAND.name}
            </span>
          </Link>
          <nav aria-label={t("nav.account")} className="flex flex-wrap items-center gap-2">
            <LanguageSwitcher compact />
            {user ? (
              <Button to={dashboardPathForRole(user.role)}>{t("nav.myDashboard")}</Button>
            ) : (
              <>
                <Button to="/login" variant="ghost">
                  {t("auth.login")}
                </Button>
                <Button to="/signup">{t("auth.signup")}</Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="flex w-full flex-col gap-2 px-4 py-6 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            © {new Date().getFullYear()} <span lang="en">{BRAND.name}</span>
          </p>
          <RecaptchaNotice />
        </div>
      </footer>
    </div>
  );
}

export default PublicLayout;
