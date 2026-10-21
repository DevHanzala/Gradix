import { Component } from "react";
import { FaExclamationTriangle, FaHome, FaSync } from "react-icons/fa";
import i18n from "../i18n/index.js";

/**
 * Last-resort screen for render errors. Deliberately uses only plain elements
 * (no router, stores or UI kit) so it cannot itself fail. Text comes from the
 * i18n instance directly (no hooks in a class component).
 */
class ErrorBoundary extends Component {
  state = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const t = (key) => i18n.t(key);
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div role="alert" className="w-full max-w-md rounded-card bg-surface p-6 text-center shadow-card sm:p-8">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger-50 text-2xl text-danger-600">
            <FaExclamationTriangle aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-xl font-bold text-ink">{t("errors.boundary.title")}</h1>
          <p className="mt-2 text-ink-muted">{t("errors.boundary.body")}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
              <FaSync aria-hidden="true" /> {t("errors.boundary.reload")}
            </button>
            <button type="button" className="btn-secondary" onClick={() => (window.location.href = "/")}>
              <FaHome aria-hidden="true" /> {t("common.goHome")}
            </button>
          </div>
          {import.meta.env.DEV && this.state.error && (
            <details className="mt-6 text-start">
              <summary className="cursor-pointer text-sm font-semibold text-ink-muted">{t("errors.boundary.details")}</summary>
              <pre className="mt-3 max-h-48 overflow-auto rounded-control bg-gray-900 p-3 text-xs text-gray-100">
                {String(this.state.error?.stack || this.state.error)}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
