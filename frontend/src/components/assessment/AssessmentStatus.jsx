import { FaCheckCircle, FaCog, FaExclamationTriangle, FaLock, FaPencilAlt } from "react-icons/fa";
import { Badge } from "../ui";
import { STATUS_STEPS, statusKey } from "./assessmentStatusKey.js";

/** Lifecycle badge: draft -> objectives_ready -> publishing -> published (-> started). */

const STATUS = {
  draft: { tone: "neutral", icon: FaPencilAlt, label: "Draft" },
  extracting: { tone: "primary", icon: FaCog, label: "Finding objectives…" },
  failed: { tone: "danger", icon: FaExclamationTriangle, label: "Objectives needed" },
  objectives_ready: { tone: "primary", icon: FaCheckCircle, label: "Objectives ready" },
  publishing: { tone: "warning", icon: FaCog, label: "Publishing…" },
  published: { tone: "success", icon: FaCheckCircle, label: "Published" },
  executed: { tone: "warning", icon: FaLock, label: "Started · locked" },
};

function AssessmentStatus({ assessment }) {
  const s = STATUS[statusKey(assessment)] || STATUS.draft;
  const spinning = s.icon === FaCog;
  return (
    <Badge tone={s.tone} icon={spinning ? undefined : s.icon}>
      {spinning && <FaCog aria-hidden="true" className="motion-safe:animate-spin" />}
      {s.label}
    </Badge>
  );
}

/** Horizontal step indicator for the lifecycle. */
export function StatusSteps({ assessment }) {
  const key = statusKey(assessment);
  const current = key === "executed" ? 3 : Math.max(0, STATUS_STEPS.indexOf(["extracting", "failed"].includes(key) ? "draft" : key));
  const labels = ["Draft", "Objectives ready", "Publishing", "Published"];
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm" aria-label="Assessment progress">
      {labels.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span
            aria-current={i === current ? "step" : undefined}
            className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 font-semibold ${
              i < current ? "bg-success-50 text-success-700" : i === current ? "bg-primary-600 text-white" : "bg-gray-100 text-ink-subtle"
            }`}
          >
            {i + 1}
          </span>
          <span className={i === current ? "font-semibold text-ink" : "text-ink-muted"}>{label}</span>
          {i < labels.length - 1 && <span aria-hidden="true" className="text-ink-subtle rtl:rotate-180">›</span>}
        </li>
      ))}
    </ol>
  );
}

export default AssessmentStatus;
