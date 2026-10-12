// main.jsx — FINAL VERSION WITH ERROR BOUNDARY

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// ADD THIS — ERROR BOUNDARY
import ErrorBoundary from './components/ErrorBoundary.jsx'; // path to your ErrorBoundary file

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* WRAP APP WITH ERROR BOUNDARY — CATCHES ALL ERRORS */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);