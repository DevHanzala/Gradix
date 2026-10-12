import { Component } from "react";
import { FaExclamationTriangle, FaHome, FaSync } from "react-icons/fa";

/**
 * Last-resort screen for render errors. Deliberately uses only plain elements
 * (no router, stores or UI kit) so it cannot itself fail.
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

    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div role="alert" className="w-full max-w-md rounded-card bg-surface p-6 text-center shadow-card sm:p-8">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger-50 text-2xl text-danger-600">
            <FaExclamationTriangle aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-xl font-bold text-ink">Something went wrong</h1>
          <p className="mt-2 text-ink-muted">The page hit an unexpected error. Reloading usually fixes it; your saved work is not lost.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
              <FaSync aria-hidden="true" /> Reload page
            </button>
            <button type="button" className="btn-secondary" onClick={() => (window.location.href = "/")}>
              <FaHome aria-hidden="true" /> Go to home
            </button>
          </div>
          {import.meta.env.DEV && this.state.error && (
            <details className="mt-6 text-start">
              <summary className="cursor-pointer text-sm font-semibold text-ink-muted">Technical details (development only)</summary>
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
