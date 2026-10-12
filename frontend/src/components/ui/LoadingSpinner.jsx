import Spinner from "./Spinner.jsx";

/** Backwards-compatible wrapper around Spinner (older call sites pass size/color/type). */
function LoadingSpinner({ size = "md", color }) {
  const tone = color === "white" ? "text-white" : "text-primary-600";
  return <Spinner size={size === "xl" ? "lg" : size} className={tone} />;
}

export default LoadingSpinner;
