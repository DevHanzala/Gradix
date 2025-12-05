import { useEffect } from "react";

function Modal({ isOpen, onClose, title, children, type = "info" }) {
  // Auto close after 6 seconds (perfect toast timing)
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      onClose();
    }, 6000); // ← 6 seconds

    return () => clearTimeout(timer);
  }, [isOpen, onClose]);

  // Prevent background scroll when toast is open (optional but clean)
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case "success":
        return {
          bg: "bg-green-50",
          border: "border-l-green-500",
          iconBg: "bg-green-100",
          text: "text-green-800",
          icon: "text-green-600",
        };
      case "error":
        return {
          bg: "bg-red-50",
          border: "border-l-red-500",
          iconBg: "bg-red-100",
          text: "text-red-800",
          icon: "text-red-600",
        };
      case "warning":
        return {
          bg: "bg-yellow-50",
          border: "border-l-yellow-500",
          iconBg: "bg-yellow-100",
          text: "text-yellow-800",
          icon: "text-yellow-600",
        };
      default:
        return {
          bg: "bg-blue-50",
          border: "border-l-blue-500",
          iconBg: "bg-blue-100",
          text: "text-blue-800",
          icon: "text-blue-600",
        };
    }
  };

  const styles = getTypeStyles();

  const getIcon = () => {
    switch (type) {
      case "success":
        return "✓";
      case "error":
        return "✗";
      case "warning":
        return "⚠";
      default:
        return "ℹ";
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {/* Top-Right Position */}
      <div className="absolute top-4 right-4 max-w-sm w-full pointer-events-auto">
        <div
          className={`
            bg-white rounded-2xl shadow-2xl border-l-4 ${styles.border} ${styles.bg}
            transform transition-all duration-500 ease-out
            animate-in slide-in-from-top-4 fade-in
          `}
        >
          <div className="p-5">
            <div className="flex items-start space-x-4">
              {/* Icon Circle */}
              <div className={`flex-shrink-0 w-12 h-12 ${styles.iconBg} rounded-full flex items-center justify-center`}>
                <span className={`text-2xl font-bold ${styles.icon}`}>{getIcon()}</span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className={`text-lg font-bold ${styles.text} mb-1`}>{title}</h3>
                <div className="text-gray-700 text-sm leading-relaxed">{children}</div>
              </div>
            </div>

            {/* Progress Bar (6 seconds) */}
            <div className="mt-4 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${styles.icon.replace("600", "500")} transition-all duration-6000 ease-linear`}
                style={{ width: "100%" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Modal;