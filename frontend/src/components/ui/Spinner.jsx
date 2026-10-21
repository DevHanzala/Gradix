import { useTranslation } from "react-i18next";
const SIZES = { sm: "h-4 w-4 border-2", md: "h-6 w-6 border-2", lg: "h-10 w-10 border-[3px]" };

/** Accessible loading indicator. Pass `label` to announce it to screen readers. */
function Spinner({ size = "md", label, className = "text-primary-600" }) {
  return (
    <span role={label ? "status" : undefined} className={`inline-flex items-center gap-2 ${className}`}>
      <span
        aria-hidden="true"
        className={`inline-block animate-spin rounded-full border-current border-e-transparent ${SIZES[size] || SIZES.md}`}
      />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

/** Full-width block spinner for loading a whole section or page. */
export function PageSpinner({ label }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-muted" role="status">
      <Spinner size="lg" />
      <span>{label || t("common.loading")}</span>
    </div>
  );
}

export default Spinner;
