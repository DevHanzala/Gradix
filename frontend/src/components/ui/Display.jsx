import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaArrowLeft, FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaTimesCircle } from "react-icons/fa";

const TONES = {
  neutral: "bg-gray-100 text-ink-muted ring-gray-200",
  primary: "bg-primary-50 text-primary-700 ring-primary-200",
  success: "bg-success-50 text-success-700 ring-success-100",
  warning: "bg-warning-50 text-warning-700 ring-warning-100",
  danger: "bg-danger-50 text-danger-700 ring-danger-100",
};

/** Small status label, e.g. <Badge tone="success">Completed</Badge>. */
export function Badge({ tone = "neutral", icon: Icon, className = "", children }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONES[tone] || TONES.neutral} ${className}`}>
      {Icon && <Icon aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Page title block used at the top of every page. */
export function PageHeader({ title, description, actions, backTo, backLabel }) {
  const { t } = useTranslation();
  return (
    <header className="mb-6 sm:mb-8">
      {backTo && (
        <Link
          to={backTo}
          className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-control text-sm font-semibold text-primary-700 hover:underline"
        >
          <FaArrowLeft aria-hidden="true" className="rtl:rotate-180" />
          {backLabel || t("common.back")}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2 sm:shrink-0">{actions}</div>}
      </div>
    </header>
  );
}

/** Shown when a list or section has no data. */
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      {Icon && (
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-2xl text-primary-600">
          <Icon aria-hidden="true" />
        </span>
      )}
      <p className="mt-4 font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const ALERT_STYLES = {
  info: { icon: FaInfoCircle, cls: "border-primary-200 bg-primary-50 text-primary-800" },
  success: { icon: FaCheckCircle, cls: "border-success-100 bg-success-50 text-success-700" },
  warning: { icon: FaExclamationTriangle, cls: "border-warning-100 bg-warning-50 text-warning-700" },
  danger: { icon: FaTimesCircle, cls: "border-danger-100 bg-danger-50 text-danger-700" },
};

/** Inline message box. Use tone="danger" for load errors, with an optional action. */
export function Alert({ tone = "info", title, action, className = "", children }) {
  const style = ALERT_STYLES[tone] || ALERT_STYLES.info;
  const Icon = style.icon;
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`flex gap-3 rounded-card border p-4 ${style.cls} ${className}`}>
      <Icon className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-sm">{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

/** Metric tile for dashboards. */
export function StatCard({ label, value, icon: Icon, hint }) {
  return (
    <div className="flex items-center gap-4 rounded-card bg-surface p-4 shadow-card sm:p-5">
      {Icon && (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-primary-50 text-primary-600">
          <Icon aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-sm text-ink-muted">{label}</p>
        <p className="text-2xl font-bold text-ink">{value}</p>
        {hint && <p className="text-xs text-ink-subtle">{hint}</p>}
      </div>
    </div>
  );
}

/** Placeholder block while content loads. */
export function Skeleton({ className = "h-4 w-full" }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-control bg-gray-200 ${className}`} />;
}

/** Stack of skeleton rows for list loading states. */
export function SkeletonList({ rows = 4 }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4 p-4 sm:p-6" role="status" aria-label={t("common.loading")}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
