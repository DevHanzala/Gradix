import { useTranslation } from "react-i18next";
import { FaCheckCircle, FaClock, FaMinusCircle, FaTimesCircle } from "react-icons/fa";
import { textDirection } from "../../utils/text.js";
import { formatDuration } from "../../utils/format.js";
import { Badge } from "../ui";

/**
 * Read-only review of one attempt. `items` come from the API, already graded
 * by the server (is_correct, score), so this screen always matches the score.
 * When available, each question shows the learning objective it tested and
 * its difficulty.
 */
function AnswerReview({ items, objectives = [] }) {
  const { t } = useTranslation();

  const displayAnswer = (value, type) => {
    if (value === null || value === undefined || value === "") return null;
    if (type === "true_false") {
      const v = String(value).toLowerCase();
      return v === "true" ? t("common.true") : v === "false" ? t("common.false") : String(value);
    }
    if (typeof value === "object") return value.answer || (value.rubric || []).map((r) => r.concept).join(", ") || (value.required_keywords || []).join(", ");
    return String(value);
  };
  const objectiveIndex = new Map(objectives.map((o, i) => [o.id, { ...o, number: i + 1 }]));

  return (
    <ol className="space-y-4">
      {items.map((q, i) => {
        const student = displayAnswer(q.student_answer, q.question_type);
        const correct = displayAnswer(q.correct_answer, q.question_type);
        const state = !student ? "unanswered" : q.is_correct ? "correct" : "wrong";
        const dir = textDirection(q.question_text);
        const tone = { correct: "success", wrong: "danger", unanswered: "neutral" }[state];
        const Icon = { correct: FaCheckCircle, wrong: FaTimesCircle, unanswered: FaMinusCircle }[state];
        const objective = objectiveIndex.get(q.objective_id);

        return (
          <li key={q.question_id ?? q.question_order ?? i} className="rounded-card border border-line p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-ink-muted">{t("preview.questionNumber", { number: i + 1 })}</span>
              <div className="flex flex-wrap items-center gap-2">
                {q.difficulty && <Badge>{t("bank.difficulty", { value: q.difficulty })}</Badge>}
                {q.timed_out && (
                  <Badge tone="warning" icon={FaClock}>
                    {t("review.timedOut")}
                  </Badge>
                )}
                <Badge tone={tone} icon={Icon}>
                  {t(`review.state.${state}`)}
                </Badge>
                <span className="text-sm font-semibold tabular-nums text-ink" dir="ltr">
                  {Number(q.score) > 0 ? "+" : ""}
                  {Number(q.score) || 0}
                </span>
              </div>
            </div>

            {objective && (
              <p className="mb-2 text-sm text-primary-700" dir={textDirection(objective.text)}>
                {t("review.objective", { number: objective.number, text: objective.text })}
              </p>
            )}

            <p dir={dir} className="font-medium text-ink">
              {q.question_text}
            </p>

            {Array.isArray(q.options) && q.options.length > 0 && (
              <ul dir={dir} className="mt-3 grid gap-2 sm:grid-cols-2">
                {q.options.map((opt, oi) => {
                  const isCorrect = opt === correct;
                  const isChosen = opt === student;
                  return (
                    <li
                      key={opt}
                      className={`flex items-start gap-2 rounded-control border px-3 py-2 text-sm ${
                        isCorrect ? "border-success-600 bg-success-50" : isChosen ? "border-danger-600 bg-danger-50" : "border-line"
                      }`}
                    >
                      <span className="font-semibold">{String.fromCharCode(65 + oi)}.</span>
                      <span className="flex-1">{opt}</span>
                      {isCorrect && <span className="sr-only">{t("preview.correctMarker")}</span>}
                      {isChosen && <span className="sr-only">{t("review.chosenMarker")}</span>}
                    </li>
                  );
                })}
              </ul>
            )}

            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-ink-subtle">{t("review.answerGiven")}</dt>
                <dd dir="auto" className="text-ink">
                  {student ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-ink-subtle">{t("preview.correctAnswer")}</dt>
                <dd dir="auto" className="text-ink">
                  {correct ?? "—"}
                </dd>
              </div>
              {q.time_taken_seconds !== null && q.time_taken_seconds !== undefined && (
                <div>
                  <dt className="text-ink-subtle">{t("review.timeTaken")}</dt>
                  <dd className="text-ink">{formatDuration(q.time_taken_seconds)}</dd>
                </div>
              )}
            </dl>
          </li>
        );
      })}
    </ol>
  );
}

export default AnswerReview;
