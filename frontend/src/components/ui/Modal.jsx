import { useEffect, useState } from "react";

function Modal({ isOpen, onClose, title, children, type = "info" }) {
  const [progress, setProgress] = useState(100);
  const [isClosing, setIsClosing] = useState(false);

  // Auto close with progress animation
  useEffect(() => {
    if (!isOpen) {
      setProgress(100);
      setIsClosing(false);
      return;
    }

    // Animate progress bar
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(progressInterval);
          return 0;
        }
        return prev - (100 / 60); // 60 frames over 6 seconds
      });
    }, 100);

    // Auto close after 6 seconds
    const timer = setTimeout(() => {
      setIsClosing(true);
      setTimeout(() => {
        onClose();
      }, 300); // Wait for exit animation
    }, 6000);

    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
    };
  }, [isOpen, onClose]);

  // Prevent background scroll when modal is open
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
          bg: "bg-gradient-to-br from-green-50 to-emerald-50",
          border: "border-green-500",
          iconBg: "bg-gradient-to-br from-green-500 to-emerald-600",
          text: "text-green-900",
          progressBg: "bg-green-500",
          shadow: "shadow-green-500/20",
        };
      case "error":
        return {
          bg: "bg-gradient-to-br from-red-50 to-pink-50",
          border: "border-red-500",
          iconBg: "bg-gradient-to-br from-red-500 to-pink-600",
          text: "text-red-900",
          progressBg: "bg-red-500",
          shadow: "shadow-red-500/20",
        };
      case "warning":
        return {
          bg: "bg-gradient-to-br from-yellow-50 to-amber-50",
          border: "border-yellow-500",
          iconBg: "bg-gradient-to-br from-yellow-500 to-amber-600",
          text: "text-yellow-900",
          progressBg: "bg-yellow-500",
          shadow: "shadow-yellow-500/20",
        };
      default:
        return {
          bg: "bg-gradient-to-br from-blue-50 to-indigo-50",
          border: "border-blue-500",
          iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600",
          text: "text-blue-900",
          progressBg: "bg-blue-500",
          shadow: "shadow-blue-500/20",
        };
    }
  };

  const styles = getTypeStyles();

  const getIcon = () => {
    switch (type) {
      case "success":
        return (
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        );
      case "error":
        return (
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case "warning":
        return (
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      default:
        return (
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-50 p-4">
      {/* Backdrop blur effect - only visible on mobile for better UX */}
      <div 
        className={`sm:hidden fixed inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto ${
          isClosing ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={() => {
          setIsClosing(true);
          setTimeout(() => onClose(), 300);
        }}
      />

      {/* Modal Container - Responsive positioning */}
      <div className="fixed top-4 right-4 left-4 sm:left-auto sm:max-w-md w-full sm:w-auto pointer-events-auto">
        <div
          className={`
            bg-white rounded-2xl sm:rounded-3xl shadow-2xl ${styles.shadow} border-l-[6px] ${styles.border}
            transform transition-all duration-300 ease-out
            ${isClosing 
              ? 'translate-x-full opacity-0 scale-95' 
              : 'translate-x-0 opacity-100 scale-100'
            }
            hover:scale-[1.02] active:scale-[0.98]
          `}
        >
          {/* Close button */}
          <button
            onClick={() => {
              setIsClosing(true);
              setTimeout(() => onClose(), 300);
            }}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-all duration-200 hover:rotate-90 active:scale-90"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className={`p-5 sm:p-6 ${styles.bg} rounded-2xl sm:rounded-3xl`}>
            <div className="flex items-start space-x-3 sm:space-x-4">
              {/* Icon Circle with animation */}
              <div 
                className={`flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 ${styles.iconBg} rounded-2xl flex items-center justify-center text-white shadow-lg transform transition-transform duration-500 hover:rotate-12 hover:scale-110`}
              >
                {getIcon()}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pr-6">
                <h3 className={`text-base sm:text-lg font-bold ${styles.text} mb-1.5 sm:mb-2 leading-tight`}>
                  {title}
                </h3>
                <div className="text-gray-700 text-sm sm:text-base leading-relaxed">
                  {children}
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4 sm:mt-5 h-1.5 sm:h-2 bg-gray-200/60 rounded-full overflow-hidden backdrop-blur-sm">
              <div
                className={`h-full ${styles.progressBg} rounded-full transition-all ease-linear shadow-lg`}
                style={{ 
                  width: `${progress}%`,
                  transitionDuration: '100ms'
                }}
              />
            </div>

            {/* Time remaining indicator */}
            <div className="mt-2 text-xs text-gray-500 text-right font-medium">
              Auto-close in {Math.ceil(progress / (100/6))}s
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInFromRight {
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