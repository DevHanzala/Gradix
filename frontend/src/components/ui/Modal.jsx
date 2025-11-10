import { useEffect } from "react"

function Modal({ isOpen, onClose, title, children, type = "info" }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }

    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  if (!isOpen) return null

  const getTypeStyles = () => {
    switch (type) {
      case "success":
        return "border-green-200 bg-green-50"
      case "error":
        return "border-red-200 bg-red-50"
      case "warning":
        return "border-yellow-200 bg-yellow-50"
      default:
        return "border-blue-200 bg-blue-50"
    }
  }

  const getIconColor = () => {
    switch (type) {
      case "success":
        return "text-green-600"
      case "error":
        return "text-red-600"
      case "warning":
        return "text-yellow-600"
      default:
        return "text-blue-600"
    }
  }

  const getIcon = () => {
    switch (type) {
      case "success":
        return "✓"
      case "error":
        return "✗"
      case "warning":
        return "⚠"
      default:
        return "ℹ"
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className={`p-6 border-l-4 ${getTypeStyles()}`}>
          <div className="flex items-center mb-4">
            <div className={`text-2xl mr-3 ${getIconColor()}`}>{getIcon()}</div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
          <div className="text-gray-700 mb-6">{children}</div>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition duration-200"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Modal
