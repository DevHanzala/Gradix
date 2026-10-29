import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FaCheckCircle, FaPaperPlane } from "react-icons/fa";
import { textDirection } from "../../utils/text.js";
import { Alert, Button, Card, CardBody } from "../ui";

const UNDERSTANDING = [1, 2, 3, 4, 5];

/**
 * Participant: answer the open poll or exit ticket (one response). The exit ticket's
 * prompts are written in the session's language, whatever the UI language is.
 */
function PollResponder({ poll, sessionLanguage, onSubmit }) {
  const { t, i18n } = useTranslation();
  const tSession = i18n.getFixedT(sessionLanguage || i18n.language);
  const [choice, setChoice] = useState(poll.kind === "multiple" ? [] : "");
  const [text, setText] = useState("");
  const [ticket, setTicket] = useState({ understanding: 0, learned: "", question: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (poll.myAnswer !== null && poll.myAnswer !== undefined) {
    return (
      <Card className="mb-6">
        <CardBody className="flex items-center gap-3">
          <FaCheckCircle aria-hidden="true" className="text-2xl text-success-600" />
          <p className="font-semibold text-ink">{t("live.pollThanks")}</p>
        </CardBody>
      </Card>
    );
  }

  const answer = poll.kind === "text" ? text.trim() : poll.kind === "exit_ticket" ? ticket : choice;
  const ready =
    poll.kind === "exit_ticket" ? ticket.understanding > 0 && ticket.learned.trim() : poll.kind === "multiple" ? choice.length > 0 : Boolean(answer);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const message = await onSubmit(answer);
    if (message) setError(message);
    setBusy(false);
  };

  const pill = (selected) =>
    `flex min-h-12 w-full items-center gap-3 rounded-card border-2 px-4 py-2 text-start transition ${selected ? "border-primary-600 bg-primary-50" : "border-line bg-surface hover:border-primary-300"}`;

  return (
    <Card className="mb-6 border-primary-300">
      <CardBody>
        <p className="mb-1 text-sm font-semibold text-primary-700">{poll.kind === "exit_ticket" ? tSession("live.exitTicket") : t("live.quickPoll")}</p>
        <form onSubmit={submit} className="space-y-4">
          {poll.kind !== "exit_ticket" && (
            <h2 className="text-xl font-bold text-ink" dir={textDirection(poll.question)}>
              {poll.question}
            </h2>
          )}

          {poll.kind === "single" && (
            <div role="radiogroup" aria-label={poll.question} className="space-y-2">
              {poll.options.map((o) => (
                <label key={o} className={pill(choice === o)}>
                  <input type="radio" name={`poll-${poll.id}`} value={o} checked={choice === o} onChange={() => setChoice(o)} className="h-5 w-5" />
                  <span dir={textDirection(o)}>{o}</span>
                </label>
              ))}
            </div>
          )}

          {poll.kind === "multiple" && (
            <fieldset className="space-y-2">
              <legend className="sr-only">{poll.question}</legend>
              <p className="text-sm text-ink-muted">{t("live.chooseAll")}</p>
              {poll.options.map((o) => (
                <label key={o} className={pill(choice.includes(o))}>
                  <input
                    type="checkbox"
                    checked={choice.includes(o)}
                    onChange={(e) => setChoice((list) => (e.target.checked ? [...list, o] : list.filter((x) => x !== o)))}
                    className="h-5 w-5"
                  />
                  <span dir={textDirection(o)}>{o}</span>
                </label>
              ))}
            </fieldset>
          )}

          {poll.kind === "text" && (
            <div>
              <label htmlFor={`poll-text-${poll.id}`} className="sr-only">
                {poll.question}
              </label>
              <textarea id={`poll-text-${poll.id}`} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={3} className="w-full rounded-control border border-line-strong p-3 text-lg" />
            </div>
          )}

          {poll.kind === "exit_ticket" && (
            <div lang={sessionLanguage} className="space-y-4">
              <fieldset>
                <legend className="mb-2 font-semibold text-ink">{tSession("live.exitUnderstanding")}</legend>
                <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={tSession("live.exitUnderstanding")}>
                  {UNDERSTANDING.map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={ticket.understanding === n}
                      aria-label={tSession(`live.understanding.${n}`)}
                      onClick={() => setTicket((x) => ({ ...x, understanding: n }))}
                      className={`min-h-12 rounded-control border-2 text-lg font-bold ${ticket.understanding === n ? "border-primary-600 bg-primary-50 text-primary-800" : "border-line bg-surface"}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="mt-1 flex justify-between text-xs text-ink-muted">
                  <span>{tSession("live.understanding.1")}</span>
                  <span>{tSession("live.understanding.5")}</span>
                </p>
              </fieldset>
              <div>
                <label htmlFor={`learned-${poll.id}`} className="mb-1 block font-semibold text-ink">
                  {tSession("live.exitLearned")}
                </label>
                <textarea id={`learned-${poll.id}`} value={ticket.learned} onChange={(e) => setTicket((x) => ({ ...x, learned: e.target.value }))} maxLength={500} rows={2} className="w-full rounded-control border border-line-strong p-3" />
              </div>
              <div>
                <label htmlFor={`question-${poll.id}`} className="mb-1 block font-semibold text-ink">
                  {tSession("live.exitQuestion")} <span className="font-normal text-ink-muted">({tSession("common.optional")})</span>
                </label>
                <textarea id={`question-${poll.id}`} value={ticket.question} onChange={(e) => setTicket((x) => ({ ...x, question: e.target.value }))} maxLength={500} rows={2} className="w-full rounded-control border border-line-strong p-3" />
              </div>
            </div>
          )}

          {poll.anonymous && <p className="text-xs text-ink-subtle">{t("live.pollIsAnonymous")}</p>}
          {error && <Alert tone="danger">{error}</Alert>}
          <Button type="submit" icon={FaPaperPlane} loading={busy} disabled={!ready}>
            {t("live.sendPoll")}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

export default PollResponder;
