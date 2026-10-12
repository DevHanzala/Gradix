import { Link } from "react-router-dom";
import Spinner from "./Spinner.jsx";

const VARIANTS = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

const SIZES = {
  md: "",
  lg: "min-h-12 px-6 text-base",
};

/**
 * The only button in the app.
 * - variant: primary | secondary | ghost | danger
 * - size: md (44px, the minimum touch target) | lg
 * - `to` renders a router Link styled as a button; `href` renders an <a>.
 * - `loading` disables the button and shows a spinner (label stays for screen readers).
 */
function Button({
  variant = "primary",
  size = "md",
  type = "button",
  to,
  href,
  loading = false,
  disabled = false,
  fullWidth = false,
  icon: Icon,
  className = "",
  children,
  ...rest
}) {
  const classes = [VARIANTS[variant] || VARIANTS.primary, SIZES[size] || "", fullWidth ? "w-full" : "", className]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {loading ? <Spinner size="sm" className="text-current" /> : Icon ? <Icon aria-hidden="true" /> : null}
      <span>{children}</span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={classes} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
}

export default Button;
