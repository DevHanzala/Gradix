import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { textDirection } from "../../utils/text.js";
import { parseStructured } from "./parseStructured.js";

const BLANK = /\[\[(\d+)\]\]/g;

/** A question or option image with its alt text (signed URL from the API). */
export function QuestionImage({ image, className = "my-3 max-h-72 w-auto max-w-full rounded-control border border-line" }) {
  if (!image?.url) return null;
  return <img src={image.url} alt={image.alt || ""} loading="lazy" className={className} />;
}

/** Stem text with [[n]] shown as numbered gaps (read-only). */
export function BlankStem({ text }) {
  const parts = String(text || "").split(BLANK);
  return (
    <span dir={textDirection(text)}>
      {parts.map((part, i) => (i % 2 ? <span key={i} className="mx-1 inline-block min-w-16 border-b-2 border-ink-muted text-center text-sm text-ink-muted">({part})</span> : <Fragment key={i}>{part}</Fragment>))}
    </span>
  );
}

/** Fill in the blank: the stem with an input in place of each [[n]]. value = ["...", "..."]. */
export function FillBlankInput({ text, value, onChange, disabled = false, size = "lg" }) {
  const { t } = useTranslation();
  const answers = Array.isArray(parseStructured(value, [])) ? parseStructured(value, []) : [];
  const parts = String(text || "").split(BLANK);
  const set = (n, v) => {
    const next = [...answers];
    next[n - 1] = v;
    onChange(next);
  };
  return (
    <p className={`leading-loose text-ink ${size === "lg" ? "text-lg sm:text-xl" : "text-base"}`} dir={textDirection(text)}>
      {parts.map((part, i) =>
        i % 2 ? (
          <input
            key={i}
            type="text"
            value={answers[Number(part) - 1] ?? ""}
            onChange={(e) => set(Number(part), e.target.value)}
            disabled={disabled}
            maxLength={200}
            aria-label={t("questions.blankN", { n: part })}
            className="mx-1 inline-block w-36 rounded-control border border-line-strong px-2 py-1 align-baseline text-base"
          />
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </p>
  );
}

/** Matching: one select per left item, choosing from the right column. value = { "0": "...", ... }. */
export function MatchingInput({ options, value, onChange, disabled = false }) {
  const { t } = useTranslation();
  const chosen = parseStructured(value, {}) || {};
  const left = options?.left || [];
  const right = options?.right || [];
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">{t("questions.matchingHint")}</p>
      <ol className="space-y-3">
        {left.map((item, i) => (
          <li key={i} className="grid gap-2 rounded-card border border-line bg-surface p-3 sm:grid-cols-2 sm:items-center">
            <label htmlFor={`match-${i}`} className="font-medium text-ink" dir={textDirection(item)}>
              {i + 1}. {item}
            </label>
            <select
              id={`match-${i}`}
              value={chosen[i] ?? ""}
              disabled={disabled}
              onChange={(e) => onChange({ ...chosen, [i]: e.target.value })}
              className="min-h-11 w-full rounded-control border border-line-strong px-2"
            >
              <option value="">{t("questions.choose")}</option>
              {right.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Student answer to a structured question, readable (review screens). */
export function StructuredAnswer({ question, answer }) {
  const { t } = useTranslation();
  const value = parseStructured(answer, null);
  if (value === null || value === undefined) return <span className="text-ink-muted">{t("questions.noAnswer")}</span>;
  if (question.question_type === "fill_blank" && Array.isArray(value)) {
    return <span>{value.map((v, i) => `(${i + 1}) ${v || "–"}`).join("  ")}</span>;
  }
  if (question.question_type === "matching") {
    const left = question.options?.left || [];
    return (
      <ul className="space-y-1">
        {left.map((l, i) => (
          <li key={i}>
            {l} → {value[i] || "–"}
          </li>
        ))}
      </ul>
    );
  }
  return <span>{String(value)}</span>;
}
