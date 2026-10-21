import { useTranslation } from "react-i18next";
import { formatNumber } from "../../utils/format.js";

/**
 * Score distribution: one bar per 10-point band (single hue, count printed
 * above each bar, so values never depend on reading bar height).
 */
function ScoreDistribution({ buckets }) {
  const { t } = useTranslation();
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <figure>
      <div className="flex h-40 items-end gap-1 sm:gap-2" role="img" aria-label={t("insights.distributionLabel")} dir="ltr">
        {buckets.map((b) => {
          const label = t("insights.bucket", { from: b.from, to: b.to, count: formatNumber(b.count) });
          return (
            <div key={b.from} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={label}>
              <span className="text-xs tabular-nums text-ink-muted">{b.count ? formatNumber(b.count) : ""}</span>
              <div className="w-full rounded-t bg-primary-600" style={{ height: `${(b.count / max) * 100}%`, minHeight: b.count ? 4 : 0 }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1 text-[10px] text-ink-subtle sm:gap-2" dir="ltr" aria-hidden="true">
        {buckets.map((b) => (
          <span key={b.from} className="flex-1 text-center tabular-nums">
            {b.from}
          </span>
        ))}
      </div>
      <figcaption className="mt-1 text-xs text-ink-subtle">{t("insights.distributionAxis")}</figcaption>
      <table className="sr-only">
        <caption>{t("insights.distributionLabel")}</caption>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.from}>
              <th scope="row">
                {b.from}–{b.to}
              </th>
              <td>{b.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export default ScoreDistribution;
