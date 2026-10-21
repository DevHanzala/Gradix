import { useTranslation } from "react-i18next";
import { FaExclamationTriangle } from "react-icons/fa";
import { formatNumber, formatPercent } from "../../utils/format.js";
import { textDirection } from "../../utils/text.js";

/**
 * Accuracy per learning objective: one horizontal bar per objective, one hue
 * (magnitude), value printed next to the bar so the number never depends on
 * reading the bar. Weak objectives carry an icon + label, not color alone.
 */
function ObjectiveBars({ objectives, weakIds = new Set() }) {
  const { t } = useTranslation();
  if (!objectives.length) return <p className="text-sm text-ink-muted">{t("learning.noObjectives")}</p>;

  return (
    <ul className="space-y-4">
      {objectives.map((o) => {
        const weak = weakIds.has(o.objectiveId);
        const label = t("learning.objectiveRow", { number: o.number, text: o.text });
        const value = t("learning.objectiveValue", {
          correct: formatNumber(o.correct),
          total: formatNumber(o.questions),
          percent: formatPercent(o.accuracy),
        });
        return (
          <li key={o.objectiveId}>
            <div className="mb-1 flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-sm">
              <span className="min-w-0 flex-1 font-medium text-ink" dir={textDirection(o.text)}>
                {label}
              </span>
              <span className="flex shrink-0 items-center gap-2 tabular-nums text-ink-muted">
                {weak && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-xs font-semibold text-warning-700">
                    <FaExclamationTriangle aria-hidden="true" />
                    {t("learning.needsWork")}
                  </span>
                )}
                {value}
              </span>
            </div>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-primary-50"
              role="img"
              aria-label={`${label}: ${value}`}
              title={`${label}: ${value}`}
            >
              <div className="h-full rounded-full bg-primary-600 transition-[width]" style={{ width: `${Math.max(0, Math.min(100, o.accuracy))}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default ObjectiveBars;
