function LoadingSpinner({ size = "md", color = "blue", type = "spinner" }) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
    xl: "w-16 h-16",
  };

  const colorClasses = {
    blue: "border-blue-600",
    green: "border-green-600",
    red: "border-red-600",
    gray: "border-gray-600",
    white: "border-white",
    purple: "border-purple-600",
  };

  const gradientColors = {
    blue: "from-blue-600 to-purple-600",
    green: "from-green-600 to-emerald-600",
    red: "from-red-600 to-pink-600",
    gray: "from-gray-600 to-gray-800",
    white: "from-white to-gray-100",
    purple: "from-purple-600 to-pink-600",
  };

  // Modern circular spinner with gradient
  if (type === "spinner" || !type) {
    return (
      <div className="flex justify-center items-center">
        <div className="relative">
          <div
            className={`${sizeClasses[size]} rounded-full border-4 border-gray-200`}
          ></div>
          <div
            className={`absolute top-0 left-0 ${sizeClasses[size]} rounded-full border-4 ${colorClasses[color]} border-t-transparent animate-spin`}
          ></div>
        </div>
      </div>
    );
  }

  // Gradient spinner with glow effect
  if (type === "gradient") {
    return (
      <div className="flex justify-center items-center">
        <div className="relative">
          <div
            className={`${sizeClasses[size]} rounded-full bg-gradient-to-r ${gradientColors[color]} animate-spin`}
            style={{
              WebkitMask: "radial-gradient(farthest-side,#0000 calc(100% - 8px),#000 0)",
              mask: "radial-gradient(farthest-side,#0000 calc(100% - 8px),#000 0)"
            }}
          ></div>
        </div>
      </div>
    );
  }

  // Dots loader
  if (type === "dots") {
    const dotSize = {
      sm: "w-2 h-2",
      md: "w-3 h-3",
      lg: "w-4 h-4",
      xl: "w-5 h-5",
    };

    const dotColor = {
      blue: "bg-blue-600",
      green: "bg-green-600",
      red: "bg-red-600",
      gray: "bg-gray-600",
      white: "bg-white",
      purple: "bg-purple-600",
    };

    return (
      <div className="flex justify-center items-center space-x-2">
        <div
          className={`${dotSize[size]} ${dotColor[color]} rounded-full animate-bounce`}
          style={{ animationDelay: "0ms" }}
        ></div>
        <div
          className={`${dotSize[size]} ${dotColor[color]} rounded-full animate-bounce`}
          style={{ animationDelay: "150ms" }}
        ></div>
        <div
          className={`${dotSize[size]} ${dotColor[color]} rounded-full animate-bounce`}
          style={{ animationDelay: "300ms" }}
        ></div>
      </div>
    );
  }

  // Pulse loader
  if (type === "pulse") {
    const pulseColor = {
      blue: "bg-blue-600",
      green: "bg-green-600",
      red: "bg-red-600",
      gray: "bg-gray-600",
      white: "bg-white",
      purple: "bg-purple-600",
    };

    return (
      <div className="flex justify-center items-center">
        <div className="relative">
          <div
            className={`${sizeClasses[size]} ${pulseColor[color]} rounded-full animate-ping opacity-75`}
          ></div>
          <div
            className={`absolute top-0 left-0 ${sizeClasses[size]} ${pulseColor[color]} rounded-full`}
          ></div>
        </div>
      </div>
    );
  }

  // Bars loader
  if (type === "bars") {
    const barWidth = {
      sm: "w-1",
      md: "w-1.5",
      lg: "w-2",
      xl: "w-3",
    };

    const barHeight = {
      sm: "h-4",
      md: "h-8",
      lg: "h-12",
      xl: "h-16",
    };

    const barColor = {
      blue: "bg-blue-600",
      green: "bg-green-600",
      red: "bg-red-600",
      gray: "bg-gray-600",
      white: "bg-white",
      purple: "bg-purple-600",
    };

    return (
      <div className="flex justify-center items-center space-x-1">
        <div
          className={`${barWidth[size]} ${barHeight[size]} ${barColor[color]} rounded-full animate-pulse`}
          style={{ animationDelay: "0ms", animationDuration: "1s" }}
        ></div>
        <div
          className={`${barWidth[size]} ${barHeight[size]} ${barColor[color]} rounded-full animate-pulse`}
          style={{ animationDelay: "150ms", animationDuration: "1s" }}
        ></div>
        <div
          className={`${barWidth[size]} ${barHeight[size]} ${barColor[color]} rounded-full animate-pulse`}
          style={{ animationDelay: "300ms", animationDuration: "1s" }}
        ></div>
        <div
          className={`${barWidth[size]} ${barHeight[size]} ${barColor[color]} rounded-full animate-pulse`}
          style={{ animationDelay: "450ms", animationDuration: "1s" }}
        ></div>
      </div>
    );
  }

  // Default to spinner
  return (
    <div className="flex justify-center items-center">
      <div className="relative">
        <div
          className={`${sizeClasses[size]} rounded-full border-4 border-gray-200`}
        ></div>
        <div
          className={`absolute top-0 left-0 ${sizeClasses[size]} rounded-full border-4 ${colorClasses[color]} border-t-transparent animate-spin`}
        ></div>
      </div>
    </div>
  );
}

export default LoadingSpinner;