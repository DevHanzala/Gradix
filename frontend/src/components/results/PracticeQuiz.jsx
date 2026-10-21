import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FaCheckCircle, FaDumbbell, FaRedo, FaTimesCircle } from "react-icons/fa";
import { checkPracticeAnswerAPI, createPracticeAPI } from "../../api/studentAnalytics.api.js";
import { errorMessage } from "../../utils/forms.js";
import { isRtl } from "../../utils/languages.js";
import { Alert, Badge, Button, EmptyState } from "../ui";

/**
 * Ungraded practice on the weak objectives. Fresh questions (never from the
 * exam), one at a time with instant feedback; nothing is scored.
 */
function PracticeQuiz({ assessmentId, language, hasObjectives }) {
  const { t, i18n } = useTranslation();
  const tq = i18n.getFixedT(language);
  const [session, setSession] = useState(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await createPracticeAPI(assessmentId, { language, count: 5 });
      setSession(res.data.data);
      setIndex(0);
      setAnswer(null);
      setFeedback(null);
      setCorrectCount(0);
    } catch (e) {
      setError(errorMessage(e, t("learning.practiceFailed")));
    } finally {
      setLoading(false);
    }
  };

  const check = async () => {
    setLoading(true);
    try {
      const res = await checkPracticeAnswerAPI(session.sessionId, index, answer);
      setFeedback(res.data.data);
      if (res.data.data.correct) setCorrectCount((c) => c + 1);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const next = () => {
    setIndex((i) => i + 1);
    setAnswer(null);
    setFeedback(null);
  };

  if (!hasObjectives) return <p className="text-sm text-ink-muted">{t("learning.noObjectives")}</p>;
  if (!session) {
    return (
      <>
        {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
        <EmptyState
          icon={FaDumbbell}
          title={t("learning.practiceTitle")}
          description={t("learning.practiceEmpty")}
          action={
            <Button icon={FaDumbbell} loading={loading} onClick={start}>
              {t("learning.practiceStart")}
            </Button>
          }
        />
      </>
    );
  }

  const dir = isRtl(session.language) ? "rtl" : "ltr";
  const done = index >= session.questions.length;
  if (done) {
    return (
      <div className="space-y-4 text-center" dir={dir} lang={session.language}>
        <p className="text-lg font-semibold text-ink">
          {tq("learning.practiceDone", { correct: correctCount, total: session.questions.length })}
        </p>
        <p className="text-sm text-ink-muted">{tq("learning.practiceUngraded")}</p>
        <Button variant="secondary" icon={FaRedo} loading={loading} onClick={start}>
          {t("learning.practiceAgain")}
        </Button>
      </div>
    );
  }

  const q = session.questions[index];
  const choices = q.question_type === "multiple_choice" ? q.options : [true, false];
  const label = (c) => (typeof c === "boolean" ? (c ? tq("common.true") : tq("common.false")) : c);
  const correctLabel = feedback && label(feedback.correctAnswer);

  return (
    <div dir={dir} lang={session.language} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted">
        <span>{tq("exam.progress", { current: index + 1, total: session.questions.length })}</span>
        <Badge>{tq("learning.practiceUngradedShort")}</Badge>
      </div>
      <p className="text-lg font-semibold text-ink">{q.question_text}</p>
      <div role="radiogroup" aria-label={tq("exam.answerOptions")} className="grid gap-2 sm:grid-cols-2">
        {choices.map((c) => {
          const selected = answer === c;
          return (
            <button
              key={String(c)}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={Boolean(feedback)}
              onClick={() => setAnswer(c)}
              className={`min-h-12 rounded-card border-2 p-3 text-start transition focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-200 ${
                selected ? "border-primary-600 bg-primary-50" : "border-line bg-surface hover:border-primary-300"
              }`}
            >
              {label(c)}
            </button>
          );
        })}
      </div>
      {feedback && (
        <Alert tone={feedback.correct ? "success" : "danger"}>
          <span className="inline-flex items-center gap-2 font-semibold">
            {feedback.correct ? <FaCheckCircle aria-hidden="true" /> : <FaTimesCircle aria-hidden="true" />}
            {feedback.correct ? tq("review.state.correct") : tq("learning.practiceWrong", { answer: correctLabel })}
          </span>
        </Alert>
      )}
      <div className="flex justify-end">
        {feedback ? (
          <Button onClick={next}>{tq("common.next")}</Button>
        ) : (
          <Button onClick={check} disabled={answer === null} loading={loading}>
            {tq("learning.practiceCheck")}
          </Button>
        )}
      </div>
    </div>
  );
}

export default PracticeQuiz;
