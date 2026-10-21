import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// Initialise translations (and <html lang dir>) before the first render.
import "./i18n/index.js";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/* Catches render errors anywhere in the app */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
