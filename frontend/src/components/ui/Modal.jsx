import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaTimes, FaTimesCircle } from "react-icons/fa";

const TYPE_STYLES = {
  success: { icon: FaCheckCircle, color: "text-success-600", bg: "bg-success-50" },
  error: { icon: FaTimesCircle, color: "text-danger-600", bg: "bg-danger-50" },
  warning: { icon: FaExclamationTriangle, color: "text-warning-600", bg: "bg-warning-50" },
  info: { icon: FaInfoCircle, color: "text-primary-600", bg: "bg-primary-50" },
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog.
 * - Focus moves into the dialog, Tab is trapped, Escape closes, focus returns on close.
 * - Full-screen sheet on mobile, centered card from `sm` up.
 * - Pass `onConfirm` for a confirm dialog (Cancel + Confirm buttons).
 */
function Modal({
  isOpen,
  onClose,
  title,
  children,
  type = "info",
  onConfirm,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant,
  size = "md",
}) {
  const titleId = useId();
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector(FOCUSABLE);
    (firstFocusable || panel)?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const style = TYPE_STYLES[type] || TYPE_STYLES.info;
  const Icon = style.icon;
  const isConfirm = typeof onConfirm === "function";
  const widths = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" };
  const danger = confirmVariant === "danger" || (isConfirm && type === "warning");

  const handleConfirm = async () => {
    await onConfirm();
    onCloseRef.current?.();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-gray-900/50" aria-hidden="true" onClick={() => onCloseRef.current?.()} />
      <div
        ref={panelRef}
        role={type === "error" || type === "warning" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`relative flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-xl focus:outline-none sm:max-h-[85vh] sm:rounded-2xl ${widths[size] || widths.md}`}
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${style.bg} ${style.color}`}>
            <Icon aria-hidden="true" />
          </span>
          {title && (
            <h2 id={titleId} className="flex-1 pt-1 text-lg font-semibold text-ink">
              {title}
            </h2>
          )}
          <button
            type="button"
            onClick={() => onCloseRef.current?.()}
            className="-me-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted hover:bg-gray-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-200"
            aria-label="Close"
          >
            <FaTimes aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 text-ink-muted">{children}</div>

        <div className="flex flex-col-reverse gap-3 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">
          {isConfirm ? (
            <>
              <button type="button" className="btn-secondary" onClick={() => onCloseRef.current?.()}>
                {cancelText}
              </button>
              <button type="button" className={danger ? "btn-danger" : "btn-primary"} onClick={handleConfirm}>
                {confirmText}
              </button>
            </>
          ) : (
            <button type="button" className="btn-primary" onClick={() => onCloseRef.current?.()}>
              OK
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default Modal;
