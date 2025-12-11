import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";

function LoadingSpinner({ size = "md", color = "blue" }) {
  const sizeClasses = {
    sm: "text-sm",
    md: "text-xl",
    lg: "text-3xl",
    xl: "text-5xl",
  };

  const colorClasses = {
    blue: "text-blue-600",
    green: "text-green-600",
    red: "text-red-600",
    gray: "text-gray-600",
    white: "text-white",
  };

  return (
    <div className="flex justify-center items-center">
      <FontAwesomeIcon
        icon={faSpinner}
        className={`animate-spin ${sizeClasses[size]} ${colorClasses[color]}`}
      />
    </div>
  );
}

export default LoadingSpinner;
