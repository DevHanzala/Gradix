/** Surface container. Use CardHeader + CardBody (or CardContent) inside. */
export function Card({ className = "", as: Tag = "section", children, ...rest }) {
  return (
    <Tag className={`rounded-card bg-surface shadow-card ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

/** Header row: title, optional description and actions (stacks on mobile). */
export function CardHeader({ title, description, actions, className = "", children }) {
  return (
    <div className={`flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 ${className}`}>
      {children || (
        <div className="min-w-0">
          {title && <h2 className="text-lg font-semibold text-ink">{title}</h2>}
          {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
        </div>
      )}
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className = "", children }) {
  return <div className={`px-4 py-4 sm:px-6 sm:py-5 ${className}`}>{children}</div>;
}

/** Alias kept for older call sites. */
export const CardContent = CardBody;

export default Card;
