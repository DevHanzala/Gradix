import { useEffect, useState } from "react";

function Modal({
  isOpen,
  onClose,
  title,
  children,
  type = "info",
  onConfirm,
  confirmText = "Confirm",
  cancelText = "Cancel",
}) {
  const [progress, setProgress] = useState(100);
  const [isClosing, setIsClosing] = useState(false);

  const isConfirmModal = typeof onConfirm === "function";

  // Auto close ONLY for non-confirm modals
  useEffect(() => {
    if (!isOpen || isConfirmModal) {
      setProgress(100);
      setIsClosing(false);
      return;
    }

    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.max(prev - 100 / 60, 0));
    }, 100);

    const timer = setTimeout(() => {
      handleClose();
    }, 6000);

    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
    };
  }, [isOpen, isConfirmModal]);

  // Prevent background scroll
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    return () => (document.body.style.overflow = "unset");
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 300);
  };

  const handleConfirm = async () => {
    await onConfirm();
    handleClose();
  };

  const getTypeStyles = () => {
    switch (type) {
      case "success":
        return {
          bg: "bg-gradient-to-br from-green-50 to-emerald-50",
          border: "border-green-500",
          icon: "✓",
          iconBg: "bg-gradient-to-br from-green-500 to-emerald-600",
          text: "text-green-900",
          progressBg: "bg-green-500",
        };
      case "error":
        return {
          bg: "bg-gradient-to-br from-red-50 to-pink-50",
          border: "border-red-500",
          icon: "✕",
          iconBg: "bg-gradient-to-br from-red-500 to-pink-600",
          text: "text-red-900",
          progressBg: "bg-red-500",
        };
      case "warning":
        return {
          bg: "bg-gradient-to-br from-yellow-50 to-amber-50",
          border: "border-yellow-500",
          icon: "⚠",
          iconBg: "bg-gradient-to-br from-yellow-500 to-amber-600",
          text: "text-yellow-900",
          progressBg: "bg-yellow-500",
        };
      default:
        return {
          bg: "bg-gradient-to-br from-blue-50 to-indigo-50",
          border: "border-blue-500",
          icon: "ℹ",
          iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600",
          text: "text-blue-900",
          progressBg: "bg-blue-500",
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Toast Container - WIDER and better positioned */}
      <div className="fixed top-4 right-4 left-1 sm:left-auto sm:right-6 md:right-8 pointer-events-auto w-full sm:max-w-md md:max-w-lg lg:max-w-xl">
        <div
          className={`
            bg-white rounded-2xl shadow-2xl border-l-4 ${styles.border}
            transform transition-all duration-300 ease-out
            ${isClosing 
              ? "translate-x-full opacity-0 scale-95" 
              : "translate-x-0 opacity-100 scale-100"
            }
          `}
          style={{
            animation: !isClosing ? 'slideInRight 0.3s ease-out' : undefined
          }}
        >
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-all duration-200 hover:scale-110 active:scale-95 shadow-sm z-10"
            aria-label="Close notification"
          >
            <span className="text-lg leading-none">×</span>
          </button>

          {/* Content Area */}
          <div className={`p-5 sm:p-6 ${styles.bg} rounded-2xl`}>
            <div className="flex items-start gap-4 mb-3">
              {/* Icon Badge */}
              <div
                className={`
                  flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full ${styles.iconBg}
                  flex items-center justify-center text-white text-xl sm:text-2xl font-bold
                  shadow-lg
                `}
              >
                {styles.icon}
              </div>

              {/* Text Content */}
              <div className="flex-1 pr-6">
                <h3 className={`text-base sm:text-lg font-bold ${styles.text} mb-1.5 leading-tight`}>
                  {title}
                </h3>
                <div className="text-sm sm:text-base text-gray-700 leading-relaxed">
                  {children}
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS (ONLY FOR CONFIRM MODALS) */}
            {isConfirmModal && (
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 mt-5 pt-4 border-t border-gray-200">
                <button
                  onClick={handleClose}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-700 transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm"
                >
                  {cancelText}
                </button>

                <button
                  onClick={handleConfirm}
                  className={`
                    w-full sm:w-auto px-5 py-2.5 rounded-xl text-white text-sm font-semibold
                    transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg
                    ${type === "warning"
                      ? "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
                      : "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                    }
                  `}
                >
                  {confirmText}
                </button>
              </div>
            )}

            {/* PROGRESS BAR (ONLY FOR AUTO-CLOSE MODALS) */}
            {!isConfirmModal && (
              <div className="mt-4 h-1.5 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                <div
                  className={`h-full ${styles.progressBg} transition-all duration-100 ease-linear rounded-full`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

export default Modal;