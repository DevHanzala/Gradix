import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDate, formatNumber } from "../../utils/format.js";

/**
 * AI tokens per day: one bar per day (single hue, baseline-anchored). The
 * hovered or focused bar's value is shown above the chart, and the full data
 * is in a visually hidden table, so nothing depends on reading bar height.
 */
function TokensPerDay({ days }) {
  const { t } = useTranslation();
  const [active, setActive] = useState(null);
  const max = Math.max(1, ...days.map((d) => d.tokens));
  const total = days.reduce((s, d) => s + d.tokens, 0);
  const shown = active === null ? null : days[active];
  const dayLabel = (d) => formatDate(`${d.day}T12:00:00Z`, { day: "numeric", month: "short" });

  return (
    <figure>
      <p className="mb-2 min-h-5 text-sm text-ink-muted" aria-live="polite">
        {shown
          ? t("platform.dayTokens", { day: dayLabel(shown), tokens: formatNumber(shown.tokens), calls: formatNumber(shown.calls) })
          : t("platform.periodTokens", { tokens: formatNumber(total) })}
      </p>
      <div className="flex h-36 items-end gap-0.5 border-b border-line sm:gap-1" dir="ltr" aria-hidden="true">
        {days.map((d, i) => (
          <div
            key={d.day}
            className="flex h-full flex-1 items-end"
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
          >
            <div
              className={`w-full rounded-t ${active === i ? "bg-primary-800" : "bg-primary-600"}`}
              style={{ height: `${(d.tokens / max) * 100}%`, minHeight: d.tokens ? 3 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-ink-subtle" dir="ltr" aria-hidden="true">
        <span>{days.length ? dayLabel(days[0]) : ""}</span>
        <span>{days.length ? dayLabel(days[days.length - 1]) : ""}</span>
      </div>
      <figcaption className="sr-only">{t("platform.tokensPerDay")}</figcaption>
      <table className="sr-only">
        <caption>{t("platform.tokensPerDay")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("platform.day")}</th>
            <th scope="col">{t("platform.tokensShort")}</th>
            <th scope="col">{t("platform.requests")}</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <th scope="row">{dayLabel(d)}</th>
              <td>{formatNumber(d.tokens)}</td>
              <td>{formatNumber(d.calls)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export default TokensPerDay;
