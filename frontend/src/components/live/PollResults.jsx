import { useTranslation } from "react-i18next";
import { formatNumber } from "../../utils/format.js";
import { textDirection } from "../../utils/text.js";
import AnswerBars from "./AnswerBars.jsx";

/** Results of one poll: bars for choices, a list for text, a summary for exit tickets. */
function PollResults({ poll, large = false }) {
  const { t } = useTranslation();
  const listClass = `space-y-2 ${large ? "text-2xl" : "text-sm"}`;
  const person = (entry) => (entry.nickname ? <span className="font-semibold">{entry.nickname}: </span> : null);

  return (
    <div className="space-y-4">
      {poll.question && (
        <p className={`font-semibold text-ink ${large ? "text-4xl" : "text-base"}`} dir={textDirection(poll.question)}>
          {poll.question}
        </p>
      )}
      <p className={`text-ink-muted ${large ? "text-2xl" : "text-sm"}`}>
        {t("live.pollResponses", { value: formatNumber(poll.responses) })}
        {poll.anonymous && ` · ${t("live.anonymousPoll")}`}
      </p>

      {poll.tally && <AnswerBars large={large} options={poll.options} distribution={poll.tally} />}

      {poll.texts &&
        (poll.texts.length ? (
          <ul className={listClass}>
            {poll.texts.map((entry, i) => (
              <li key={i} className="rounded-control border border-line bg-surface px-3 py-2" dir={textDirection(entry.text)}>
                {person(entry)}
                {entry.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted">{t("live.noResponsesYet")}</p>
        ))}

      {poll.exitTicket && (
        <div className="space-y-4">
          <p className={`font-semibold text-ink ${large ? "text-3xl" : "text-base"}`}>
            {t("live.averageUnderstanding", {
              value: poll.exitTicket.averageUnderstanding === null ? "–" : formatNumber(poll.exitTicket.averageUnderstanding),
            })}
          </p>
          <AnswerBars large={large} options={["1", "2", "3", "4", "5"]} distribution={poll.exitTicket.distribution} />
          <div>
            <h3 className="mb-2 font-semibold text-ink">{t("live.exitLearnedHeading")}</h3>
            <ul className={listClass}>
              {poll.exitTicket.learned.map((entry, i) => (
                <li key={i} className="rounded-control border border-line bg-surface px-3 py-2" dir={textDirection(entry.text)}>
                  {person(entry)}
                  {entry.text}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 font-semibold text-ink">{t("live.exitQuestionsHeading")}</h3>
            {poll.exitTicket.questions.length ? (
              <ul className={listClass}>
                {poll.exitTicket.questions.map((entry, i) => (
                  <li key={i} className="rounded-control border border-line bg-surface px-3 py-2" dir={textDirection(entry.text)}>
                    {person(entry)}
                    {entry.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">{t("live.noQuestionsAsked")}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PollResults;
