import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// Initialise translations (and <html lang dir>) before the first render.
import "./i18n/index.js";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import WakeScreen from "./components/WakeScreen.jsx";
import { initMonitoring } from "./lib/monitoring.js";

initMonitoring();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/* Catches render errors anywhere in the app */}
    <ErrorBoundary>
      <App />
      <WakeScreen />
    </ErrorBoundary>
  </StrictMode>
);

// Installable app: the service worker caches static files only (never API responses).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
