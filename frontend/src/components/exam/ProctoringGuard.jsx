import { useEffect, useRef, useState } from "react";
import { reportAttemptEventApi } from "../../api/studentAssessment.api.js";

/**
 * During a graded exam: copy, paste and the context menu are always blocked. When the
 * assessment's proctoring is on, these moments are also reported to the server (which
 * keeps the count and may auto-submit): leaving the tab, leaving the window, leaving
 * fullscreen, and copy/paste/right-click attempts. Nothing else is recorded.
 * Renders a warning bar (level "warn" and "auto_submit").
 */
function ProctoringGuard({ attemptId, level, questionIndex, t, onAutoSubmitted }) {
  const [warning, setWarning] = useState(null);
  const indexRef = useRef(questionIndex);
  indexRef.current = questionIndex;

  useEffect(() => {
    const report = (kind) => {
      if (level === "off" || !attemptId) return;
      reportAttemptEventApi(attemptId, kind, indexRef.current)
        .then((res) => {
          const data = res.data.data;
          if (data.autoSubmitted) onAutoSubmitted?.();
          else if (level !== "log") setWarning(data);
        })
        .catch(() => {});
    };
    const block = (kind) => (e) => {
      e.preventDefault();
      report(kind);
    };
    const onCopy = block("copy");
    const onPaste = block("paste");
    const onMenu = block("context_menu");
    const onVisibility = () => document.visibilityState === "hidden" && report("tab_hidden");
    const onBlur = () => document.visibilityState === "visible" && report("window_blur");
    const onFullscreen = () => !document.fullscreenElement && report("fullscreen_exit");

    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCopy);
    document.addEventListener("paste", onPaste);
    document.addEventListener("contextmenu", onMenu);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("contextmenu", onMenu);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [attemptId, level, onAutoSubmitted]);

  if (!warning) return null;
  return (
    <div role="alert" className="mb-4 rounded-control bg-warning-50 p-3 text-sm font-semibold text-warning-700">
      {level === "auto_submit"
        ? t("exam.proctoring.warnAuto", { count: warning.violations, max: warning.maxViolations })
        : t("exam.proctoring.warn", { count: warning.violations })}
    </div>
  );
}

export default ProctoringGuard;
