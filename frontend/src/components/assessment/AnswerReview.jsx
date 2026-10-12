import { FaCheckCircle, FaMinusCircle, FaTimesCircle } from "react-icons/fa";
import { textDirection } from "../../utils/text.js";
import { Badge } from "../ui";

const displayAnswer = (value, type) => {
  if (value === null || value === undefined || value === "") return null;
  if (type === "true_false") {
    const v = String(value).toLowerCase();
    return v === "true" ? "True" : v === "false" ? "False" : String(value);
  }
  if (typeof value === "object") return value.answer || (value.required_keywords || []).join(", ");
  return String(value);
};

/**
 * Read-only review of one attempt. `items` come from the API, already graded
 * by the server (is_correct, score), so this screen always matches the score.
 */
function AnswerReview({ items }) {
  return (
    <ol className="space-y-4">
      {items.map((q, i) => {
        const student = displayAnswer(q.student_answer, q.question_type);
        const correct = displayAnswer(q.correct_answer, q.question_type);
        const state = !student ? "unanswered" : q.is_correct ? "correct" : "wrong";
        const dir = textDirection(q.question_text);
        const tone = { correct: "success", wrong: "danger", unanswered: "neutral" }[state];
        const Icon = { correct: FaCheckCircle, wrong: FaTimesCircle, unanswered: FaMinusCircle }[state];

        return (
          <li key={q.question_id ?? q.question_order ?? i} className="rounded-card border border-line p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-ink-muted">Question {i + 1}</span>
              <div className="flex items-center gap-2">
                <Badge tone={tone} icon={Icon}>
                  {state === "correct" ? "Correct" : state === "wrong" ? "Incorrect" : "Not answered"}
                </Badge>
                <span className="text-sm font-semibold tabular-nums text-ink">
                  {Number(q.score) > 0 ? "+" : ""}
                  {Number(q.score) || 0}
                </span>
              </div>
            </div>

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
                      {isCorrect && <span className="sr-only">(correct answer)</span>}
                      {isChosen && <span className="sr-only">(chosen)</span>}
                    </li>
                  );
                })}
              </ul>
            )}

            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ink-subtle">Answer given</dt>
                <dd dir="auto" className="text-ink">
                  {student ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-ink-subtle">Correct answer</dt>
                <dd dir="auto" className="text-ink">
                  {correct ?? "—"}
                </dd>
              </div>
            </dl>
          </li>
        );
      })}
    </ol>
  );
}

export default AnswerReview;
