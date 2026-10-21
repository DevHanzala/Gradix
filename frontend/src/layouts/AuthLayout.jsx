import { Link } from "react-router-dom";
import { BRAND } from "./navigation.js";
import { RecaptchaNotice } from "./PublicLayout.jsx";
import LanguageSwitcher from "../components/LanguageSwitcher.jsx";

/** Centered single-card layout for login, signup and password pages. */
function AuthLayout({ title, subtitle, children, footer, showRecaptchaNotice = false }) {
  const Icon = BRAND.icon;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="mb-6 flex w-full max-w-md flex-wrap items-center justify-between gap-3">
        <Link to="/" className="inline-flex min-h-11 items-center gap-2 font-bold text-ink">
          <span className="flex h-9 w-9 items-center justify-center rounded-control bg-primary-600 text-white">
            <Icon aria-hidden="true" />
          </span>
          <span className="text-xl" lang="en">
            {BRAND.name}
          </span>
        </Link>
        <LanguageSwitcher compact />
      </div>

      <main id="main-content" className="w-full max-w-md rounded-card bg-surface p-6 shadow-card sm:p-8">
        {title && <h1 className="text-2xl font-bold text-ink">{title}</h1>}
        {subtitle && <p className="mt-1 text-ink-muted">{subtitle}</p>}
        <div className={title || subtitle ? "mt-6" : ""}>{children}</div>
      </main>

      {footer && <div className="mt-6 text-center text-sm text-ink-muted">{footer}</div>}
      {showRecaptchaNotice && <RecaptchaNotice className="mt-4 max-w-md text-center" />}
    </div>
  );
}

export default AuthLayout;
