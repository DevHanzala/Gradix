import { Link } from "react-router-dom";
import useAuthStore from "../store/authStore.js";
import { dashboardPathForRole } from "../utils/redirectByRole.js";
import { BRAND } from "./navigation.js";
import Button from "../components/ui/Button.jsx";

export function RecaptchaNotice({ className = "" }) {
  return (
    <p className={`text-xs text-ink-subtle ${className}`}>
      This site is protected by reCAPTCHA and the Google{" "}
      <a className="underline hover:text-ink" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
        Privacy Policy
      </a>{" "}
      and{" "}
      <a className="underline hover:text-ink" href="https://policies.google.com/terms" target="_blank" rel="noreferrer">
        Terms of Service
      </a>{" "}
      apply.
    </p>
  );
}

/** Layout for public pages (home, 404 for visitors). */
function PublicLayout({ children }) {
  const { user } = useAuthStore();
  const Icon = BRAND.icon;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex min-h-11 items-center gap-2 font-bold text-ink">
            <span className="flex h-8 w-8 items-center justify-center rounded-control bg-primary-600 text-white">
              <Icon aria-hidden="true" />
            </span>
            <span className="text-lg">{BRAND.name}</span>
          </Link>
          <nav aria-label="Account" className="flex items-center gap-2">
            {user ? (
              <Button to={dashboardPathForRole(user.role)}>My dashboard</Button>
            ) : (
              <>
                <Button to="/login" variant="ghost">
                  Log in
                </Button>
                <Button to="/signup">Sign up</Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} {BRAND.name}</p>
          <RecaptchaNotice />
        </div>
      </footer>
    </div>
  );
}

export default PublicLayout;
