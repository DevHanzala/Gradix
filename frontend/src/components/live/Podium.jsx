import { useTranslation } from "react-i18next";
import { formatNumber } from "../../utils/format.js";

/** Final podium (game mode): places 2, 1, 3 side by side, then the rest of the top 5. */
function Podium({ rows, large = false }) {
  const { t } = useTranslation();
  if (!rows?.length) return null;
  const [first, second, third] = rows;
  const steps = [
    { row: second, place: 2, height: large ? "h-40" : "h-20", tone: "bg-gray-200" },
    { row: first, place: 1, height: large ? "h-56" : "h-28", tone: "bg-warning-100" },
    { row: third, place: 3, height: large ? "h-28" : "h-14", tone: "bg-orange-100" },
  ].filter((s) => s.row);

  return (
    <section aria-label={t("live.podium")} className="mt-6 w-full">
      <h2 className={`mb-4 text-center font-bold text-ink ${large ? "text-4xl" : "text-xl"}`}>{t("live.podium")}</h2>
      <ol className="flex items-end justify-center gap-3">
        {steps.map(({ row, place, height, tone }) => (
          <li key={row.id} className={`flex flex-col items-center ${large ? "w-56" : "w-28"}`}>
            <span className={`mb-2 max-w-full truncate text-center font-bold text-ink ${large ? "text-2xl" : "text-sm"}`}>{row.nickname}</span>
            <span className={`mb-2 tabular-nums text-ink-muted ${large ? "text-xl" : "text-xs"}`}>{t("live.points", { value: formatNumber(row.points) })}</span>
            <div className={`flex w-full items-start justify-center rounded-t-card ${height} ${tone}`}>
              <span className={`mt-2 font-bold text-ink ${large ? "text-5xl" : "text-2xl"}`} aria-label={t("live.place", { n: place })}>
                {formatNumber(place)}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default Podium;
