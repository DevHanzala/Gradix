import { useTranslation } from "react-i18next";
import { formatNumber } from "../../utils/format.js";

/**
 * How many chose each answer, as labelled bars (text + numbers, never color alone).
 * `correct` marks the right answer once it may be shown.
 */
function AnswerBars({ options, distribution = {}, correct = null, large = false }) {
  const { t } = useTranslation();
  const rows = (options?.length ? options : Object.keys(distribution)).map((option) => ({
    option,
    count: distribution[option] || 0,
  }));
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  if (!rows.length) return null;

  return (
    <ul className={`space-y-3 ${large ? "text-xl" : "text-sm"}`} aria-label={t("live.answerDistribution")}>
      {rows.map(({ option, count }, i) => {
        const percent = total ? Math.round((100 * count) / total) : 0;
        const isCorrect = correct !== null && String(option) === String(correct);
        return (
          <li key={`${option}-${i}`}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className={`min-w-0 break-words ${isCorrect ? "font-bold text-success-700" : "text-ink"}`}>
                {option === "true" ? t("common.true") : option === "false" ? t("common.false") : option}
                {isCorrect && <span className="ms-2">✓ {t("live.correctAnswer")}</span>}
              </span>
              <span className="shrink-0 tabular-nums text-ink-muted">
                {formatNumber(count)} · {formatNumber(percent)}%
              </span>
            </div>
            <div className={`overflow-hidden rounded-full bg-gray-100 ${large ? "h-5" : "h-3"}`}>
              <div
                className={`h-full rounded-full ${isCorrect ? "bg-success-600" : "bg-primary-500"}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default AnswerBars;
