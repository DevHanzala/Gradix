import { useTranslation } from "react-i18next";
import { formatNumber } from "../../utils/format.js";

// Team colours are always shown with the team's name and numbers, never alone.
const TEAM_COLORS = ["bg-primary-600", "bg-success-600", "bg-warning-600", "bg-danger-600", "bg-sky-600", "bg-fuchsia-600"];

/** Team race: each team's correct answers as a progress bar towards the finish line. */
function TeamRace({ teams, myTeam = null, large = false }) {
  const { t } = useTranslation();
  if (!teams?.length) return null;
  const leader = Math.max(...teams.map((x) => x.progress));
  return (
    <section aria-label={t("live.teamRace")} className="space-y-3">
      <h2 className={`font-bold text-ink ${large ? "text-3xl" : "text-lg"}`}>{t("live.teamRace")}</h2>
      <ul className="space-y-3">
        {teams.map((team, i) => (
          <li key={team.team}>
            <div className={`mb-1 flex flex-wrap items-baseline justify-between gap-x-3 ${large ? "text-lg sm:text-2xl" : "text-sm"}`}>
              <span className={`font-semibold ${team.team === myTeam ? "text-primary-700" : "text-ink"}`}>
                {t("live.teamName", { n: team.team })}
                {team.team === myTeam && ` · ${t("live.yourTeam")}`}
                {team.progress === leader && leader > 0 && " 🏁"}
              </span>
              <span className="shrink-0 tabular-nums text-ink-muted">
                {t("live.teamProgress", { correct: formatNumber(team.correct), members: formatNumber(team.members), percent: formatNumber(team.progress) })}
              </span>
            </div>
            <div
              className={`overflow-hidden rounded-full bg-gray-100 ${large ? "h-8" : "h-4"}`}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={team.progress}
              aria-label={t("live.teamName", { n: team.team })}
            >
              <div className={`h-full rounded-full transition-all duration-700 ${TEAM_COLORS[i % TEAM_COLORS.length]}`} style={{ width: `${team.progress}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default TeamRace;
