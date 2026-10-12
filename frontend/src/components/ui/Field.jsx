import { useId } from "react";

const controlBase =
  "w-full rounded-control border bg-surface px-3 text-base text-ink placeholder:text-ink-subtle transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-ink-subtle";
const controlState = (error) =>
  error ? "border-danger-600 focus:ring-danger-100" : "border-line-strong focus:border-primary-600 focus:ring-primary-200";

/**
 * Label + control + hint + field-level error, wired for screen readers.
 * Children receive the generated id through the render prop.
 */
export function FormField({ label, hint, error, required, id: givenId, className = "", children }) {
  const autoId = useId();
  const id = givenId || autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
          {label}
          {required && (
            <span className="ms-0.5 text-danger-600" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className="mt-1 text-sm text-ink-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-sm text-danger-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ label, hint, error, required, className = "", id, ...rest }) {
  return (
    <FormField label={label} hint={hint} error={error} required={required} id={id} className={className}>
      {({ id: fieldId, describedBy, invalid }) => (
        <input
          id={fieldId}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          required={required}
          className={`${controlBase} ${controlState(error)} min-h-11`}
          {...rest}
        />
      )}
    </FormField>
  );
}

export function Textarea({ label, hint, error, required, className = "", id, rows = 4, ...rest }) {
  return (
    <FormField label={label} hint={hint} error={error} required={required} id={id} className={className}>
      {({ id: fieldId, describedBy, invalid }) => (
        <textarea
          id={fieldId}
          rows={rows}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          required={required}
          className={`${controlBase} ${controlState(error)} py-2.5`}
          {...rest}
        />
      )}
    </FormField>
  );
}

export function Select({ label, hint, error, required, className = "", id, options, children, ...rest }) {
  return (
    <FormField label={label} hint={hint} error={error} required={required} id={id} className={className}>
      {({ id: fieldId, describedBy, invalid }) => (
        <select
          id={fieldId}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          required={required}
          className={`${controlBase} ${controlState(error)} min-h-11`}
          {...rest}
        >
          {options
            ? options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))
            : children}
        </select>
      )}
    </FormField>
  );
}

/** Labelled checkbox with a 44px touch target. */
export function Checkbox({ label, description, className = "", id, ...rest }) {
  const autoId = useId();
  const fieldId = id || autoId;
  return (
    <label htmlFor={fieldId} className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-control p-2 hover:bg-gray-50 ${className}`}>
      <input
        id={fieldId}
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-line-strong text-primary-600 focus:ring-primary-200"
        {...rest}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="block text-sm text-ink-subtle">{description}</span>}
      </span>
    </label>
  );
}
