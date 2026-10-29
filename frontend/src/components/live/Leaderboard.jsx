import { useTranslation } from "react-i18next";
import { FaTrophy } from "react-icons/fa";
import { formatNumber } from "../../utils/format.js";

/** Top players (game mode). */
function Leaderboard({ rows, highlightId, large = false }) {
  const { t } = useTranslation();
  if (!rows?.length) return null;
  return (
    <section aria-label={t("live.leaderboard")} className="mt-6">
      <h2 className={`mb-3 flex items-center gap-2 font-bold text-ink ${large ? "text-3xl" : "text-lg"}`}>
        <FaTrophy aria-hidden="true" className="text-warning-600" />
        {t("live.leaderboard")}
      </h2>
      <ol className="space-y-2">
        {rows.map((r, i) => (
          <li
            key={r.id}
            className={`flex items-center justify-between gap-3 rounded-control border px-4 py-2 ${
              r.id === highlightId ? "border-primary-600 bg-primary-50" : "border-line bg-surface"
            } ${large ? "text-2xl" : ""}`}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="w-6 shrink-0 font-bold tabular-nums text-ink-muted">{formatNumber(i + 1)}</span>
              <span className="truncate font-semibold">{r.nickname}</span>
            </span>
            <span className="shrink-0 font-bold tabular-nums">{formatNumber(r.points)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default Leaderboard;
