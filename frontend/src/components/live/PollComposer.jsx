import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FaPlus, FaPollH, FaTimes } from "react-icons/fa";
import { Alert, Button, Checkbox, Input, Select } from "../ui";

const MAX_OPTIONS = 6;

/** Teacher: write and launch a quick poll or the exit ticket. */
function PollComposer({ onLaunch, busy = false, error = null }) {
  const { t } = useTranslation();
  const [kind, setKind] = useState("single");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [anonymous, setAnonymous] = useState(false);
  const choice = kind === "single" || kind === "multiple";
  const filled = options.map((o) => o.trim()).filter(Boolean);
  const ready = kind === "exit_ticket" || (question.trim() && (!choice || filled.length >= 2));

  const launch = async (e) => {
    e.preventDefault();
    const ok = await onLaunch({ kind, question: question.trim(), options: choice ? filled : undefined, anonymous });
    if (ok) {
      setQuestion("");
      setOptions(["", ""]);
    }
  };

  return (
    <form onSubmit={launch} className="space-y-4" noValidate>
      <Select
        label={t("live.pollType")}
        value={kind}
        onChange={(e) => setKind(e.target.value)}
        options={[
          { value: "single", label: t("live.pollSingle") },
          { value: "multiple", label: t("live.pollMultiple") },
          { value: "text", label: t("live.pollText") },
          { value: "exit_ticket", label: t("live.exitTicket") },
        ]}
      />
      {kind === "exit_ticket" ? (
        <p className="text-sm text-ink-muted">{t("live.exitTicketHint")}</p>
      ) : (
        <Input label={t("live.pollQuestion")} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300} required />
      )}
      {choice && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-semibold text-ink">{t("live.pollOptions")}</legend>
          {options.map((option, i) => (
            <div key={i} className="flex items-end gap-2">
              <Input
                className="flex-1"
                label={t("live.pollOptionN", { n: i + 1 })}
                value={option}
                maxLength={120}
                onChange={(e) => setOptions((list) => list.map((o, j) => (j === i ? e.target.value : o)))}
              />
              {options.length > 2 && (
                <Button variant="ghost" icon={FaTimes} aria-label={t("live.removeOption", { n: i + 1 })} onClick={() => setOptions((list) => list.filter((_, j) => j !== i))}>
                  <span className="sr-only">{t("live.removeOption", { n: i + 1 })}</span>
                </Button>
              )}
            </div>
          ))}
          {options.length < MAX_OPTIONS && (
            <Button variant="secondary" icon={FaPlus} onClick={() => setOptions((list) => [...list, ""])}>
              {t("live.addOption")}
            </Button>
          )}
        </fieldset>
      )}
      <Checkbox label={t("live.anonymousPoll")} description={t("live.anonymousPollHint")} checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" icon={FaPollH} loading={busy} disabled={!ready}>
        {kind === "exit_ticket" ? t("live.launchExitTicket") : t("live.launchPoll")}
      </Button>
    </form>
  );
}

export default PollComposer;
