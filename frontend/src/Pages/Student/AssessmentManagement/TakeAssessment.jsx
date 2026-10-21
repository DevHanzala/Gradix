import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaClock, FaCheckCircle, FaCloud, FaCloudUploadAlt, FaExclamationTriangle, FaWifi } from "react-icons/fa";
import useStudentAssessmentStore from "../../../store/studentAssessmentStore.js";
import LoadingSpinner from "../../../components/ui/LoadingSpinner";
import { Button } from "../../../components/ui";
import { LANGUAGES, isRtl } from "../../../utils/languages.js";
import { formatClock, formatDuration, formatNumber, formatPercent } from "../../../utils/format.js";

/** Re-render every 250 ms while active so countdowns stay smooth. */
const useNow = (active) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [active]);
  return now;
};

const SAVE_STATES = {
  saving: { icon: FaCloudUploadAlt, cls: "text-warning-700 bg-warning-50" },
  saved: { icon: FaCloud, cls: "text-success-700 bg-success-50" },
  offline: { icon: FaWifi, cls: "text-danger-700 bg-danger-50" },
  error: { icon: FaExclamationTriangle, cls: "text-danger-700 bg-danger-50" },
};

const SaveIndicator = ({ status, t }) => {
  const item = SAVE_STATES[status];
  if (!item) return null;
  const Icon = item.icon;
  return (
    <span role="status" aria-live="polite" className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${item.cls}`}>
      <Icon aria-hidden="true" />
      {t(`exam.save.${status}`)}
    </span>
  );
};

function TakeAssessment() {
  const { t: tUi, i18n } = useTranslation();
  const { assessmentId } = useParams();
  const {
    phase,
    question: currentQuestion,
    totalQuestions,
    preparing,
    liveScore,
    lastAnswer,
    answers,
    currentIndex,
    questionDeadline,
    overallDeadline,
    language,
    saveStatus,
    result,
    error,
    errorCode,
    availableLanguages,
    loadAttempt,
    startAssessment,
    setAnswer,
    advance,
    submit,
    flushPending,
    reset,
  } = useStudentAssessmentStore();

  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const firedForIndex = useRef(null);

  useEffect(() => {
    reset();
    loadAttempt(assessmentId);
    return () => reset();
  }, [assessmentId, loadAttempt, reset]);

  // Retry pending saves as soon as the connection returns.
  useEffect(() => {
    const onOnline = () => flushPending();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flushPending]);

  const inProgress = phase === "in_progress" || phase === "submitting";
  const now = useNow(inProgress);
  const questionRemaining = inProgress ? Math.ceil((questionDeadline - now) / 1000) : 0;
  const overallRemaining = inProgress ? Math.ceil((overallDeadline - now) / 1000) : 0;
  const isLast = currentIndex >= totalQuestions - 1;

  // Per-question timeout auto-advances (last question auto-submits);
  // overall timeout auto-submits. Fire once per question index.
  useEffect(() => {
    if (phase !== "in_progress" || !currentQuestion || preparing) return;
    if (overallRemaining <= 0) {
      if (firedForIndex.current !== "overall") {
        firedForIndex.current = "overall";
        submit();
      }
      return;
    }
    if (questionRemaining <= 0 && firedForIndex.current !== currentIndex) {
      firedForIndex.current = currentIndex;
      advance();
    }
  }, [phase, questionRemaining, overallRemaining, currentIndex, currentQuestion, preparing, advance, submit]);

  // During (and right after) an attempt the interface speaks the exam's language.
  const examLanguage = inProgress || phase === "completed" ? language || selectedLanguage : selectedLanguage;
  const t = i18n.getFixedT(examLanguage);
  const dir = isRtl(examLanguage) ? "rtl" : "ltr";

  // ---------------------------------------------------------------- states

  if (phase === "idle" || phase === "loading") {
    return (
      <CenteredPanel>
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-ink-muted">{tUi("exam.loading")}</p>
      </CenteredPanel>
    );
  }

  if (phase === "error") {
    return (
      <CenteredPanel>
        <FaExclamationTriangle className="mx-auto text-4xl text-danger-600" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-bold text-ink">{errorCode === "NOT_ENROLLED" ? tUi("exam.notEnrolled") : tUi("errors.boundary.title")}</h1>
        <p className="mt-2 text-ink-muted">{error}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => loadAttempt(assessmentId)} className="btn-secondary">
            {tUi("common.tryAgain")}
          </button>
          <Link to="/student/dashboard" className="btn-primary">
            {tUi("exam.backToDashboard")}
          </Link>
        </div>
      </CenteredPanel>
    );
  }

  if (phase === "completed" && result) {
    return <ResultSummary result={result} t={t} dir={dir} lang={examLanguage} />;
  }

  if ((phase === "not_started" || phase === "starting") && availableLanguages.length === 0) {
    return (
      <CenteredPanel>
        <FaClock className="mx-auto text-4xl text-primary-600" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-bold text-ink">{tUi("studentDashboard.notAvailable")}</h1>
        <p className="mt-2 text-ink-muted">{tUi("exam.notAvailableBody")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button variant="secondary" onClick={() => loadAttempt(assessmentId)}>
            {tUi("exam.checkAgain")}
          </Button>
          <Button to="/student/dashboard">{tUi("exam.backToDashboard")}</Button>
        </div>
      </CenteredPanel>
    );
  }

  if (phase === "not_started" || phase === "starting") {
    const starting = phase === "starting";
    const offered = LANGUAGES.filter((l) => availableLanguages.includes(l.code));
    const chosenLanguage = availableLanguages.includes(selectedLanguage) ? selectedLanguage : offered[0].code;
    const tChosen = i18n.getFixedT(chosenLanguage);
    return (
      <CenteredPanel dir={isRtl(chosenLanguage) ? "rtl" : "ltr"} lang={chosenLanguage}>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">{tChosen("exam.readyTitle")}</h1>
        <p className="mt-2 text-ink-muted">{tChosen("exam.readyBody")}</p>

        <div className="mt-6 text-start">
          <label htmlFor="exam-language" className="mb-2 block text-sm font-semibold text-ink">
            {tChosen("exam.questionLanguage")}
          </label>
          <select
            id="exam-language"
            value={chosenLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            disabled={starting}
            className="w-full min-h-11 rounded-control border border-line-strong bg-surface px-3 py-2 text-base focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200"
          >
            {offered.map((l) => (
              <option key={l.code} value={l.code} lang={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <ul className="mt-6 space-y-2 rounded-control bg-primary-50 p-4 text-start text-sm text-primary-800">
          <li>• {tChosen("exam.rules.timer")}</li>
          <li>• {tChosen("exam.rules.noBack")}</li>
          <li>• {tChosen("exam.rules.autosave")}</li>
          <li>• {tChosen("exam.rules.once")}</li>
        </ul>

        {error && (
          <p role="alert" className="mt-4 rounded-control bg-danger-50 p-3 text-sm text-danger-700">
            {error}
          </p>
        )}

        <button type="button" onClick={() => startAssessment(assessmentId, chosenLanguage)} disabled={starting} className="btn-primary mt-6 w-full">
          {starting ? (
            <>
              <LoadingSpinner size="sm" color="white" />
              <span>{tChosen("exam.preparing")}</span>
            </>
          ) : (
            tChosen("exam.start")
          )}
        </button>
      </CenteredPanel>
    );
  }

  // ------------------------------------------------------------ exam view

  const question = currentQuestion;
  if (!question || preparing) {
    return (
      <CenteredPanel dir={dir} lang={examLanguage}>
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-ink-muted" role="status">
          {t("exam.preparingNext")}
        </p>
      </CenteredPanel>
    );
  }
  const answer = answers[question.id];
  const submitting = phase === "submitting";

  return (
    <div dir={dir} lang={examLanguage} className="flex min-h-screen flex-col bg-canvas">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <span className="text-sm font-semibold text-ink-muted">
            {t("exam.progress", { current: formatNumber(currentIndex + 1, undefined, examLanguage), total: formatNumber(totalQuestions, undefined, examLanguage) })}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <SaveIndicator status={saveStatus} t={t} />
            <span
              dir="ltr"
              className={`inline-flex items-center gap-1.5 rounded-control px-3 py-1.5 text-sm font-bold tabular-nums ${
                questionRemaining <= 10 ? "bg-danger-600 text-white" : "bg-primary-600 text-white"
              }`}
              aria-label={t("exam.questionTimeLeft", { time: formatClock(questionRemaining) })}
            >
              <FaClock aria-hidden="true" />
              {formatClock(questionRemaining)}
            </span>
            <span className="rounded-control bg-gray-100 px-3 py-1.5 text-sm font-semibold tabular-nums text-ink-muted">
              {t("exam.total")} <span dir="ltr">{formatClock(overallRemaining)}</span>
            </span>
          </div>
        </div>
        <div className="h-1 bg-gray-100" aria-hidden="true">
          <div className="h-1 bg-primary-600 transition-all" style={{ width: `${((currentIndex + 1) / Math.max(1, totalQuestions)) * 100}%` }} />
        </div>
      </header>

      {/* Question */}
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-32 pt-6 sm:pb-12">
        {liveScore && (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm" role="status" aria-live="polite">
            {lastAnswer && (
              <span className={`rounded-full px-3 py-1 font-semibold ${lastAnswer.correct ? "bg-success-50 text-success-700" : "bg-danger-50 text-danger-700"}`}>
                {lastAnswer.correct ? t("exam.previousCorrect") : t("exam.previousIncorrect")}
              </span>
            )}
            <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold text-ink-muted">
              {t("exam.scoreSoFar")} <span dir="ltr">{liveScore.score}</span>
            </span>
          </div>
        )}
        <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-success-50 px-3 py-1 text-success-700">
            {t("exam.correctMarks", { marks: question.positive_marks })}
          </span>
          {question.negative_marks > 0 && (
            <span className="rounded-full bg-danger-50 px-3 py-1 text-danger-700">{t("exam.wrongMarks", { marks: question.negative_marks })}</span>
          )}
        </div>

        <h1 className="text-xl font-semibold leading-relaxed text-ink sm:text-2xl">{question.question_text}</h1>

        <div className="mt-6">
          {question.question_type === "multiple_choice" && (
            <div role="radiogroup" aria-label={t("exam.answerOptions")} className="grid gap-3 sm:grid-cols-2">
              {question.options?.map((option, i) => {
                const selected = answer === option;
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setAnswer(question.id, option, question.question_type)}
                    className={`flex min-h-14 items-start gap-3 rounded-card border-2 p-4 text-start text-base transition focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-200 sm:text-lg ${
                      selected ? "border-primary-600 bg-primary-50" : "border-line bg-surface hover:border-primary-300"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        selected ? "bg-primary-600 text-white" : "bg-gray-100 text-ink-muted"
                      }`}
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="pt-0.5">{option}</span>
                  </button>
                );
              })}
            </div>
          )}

          {question.question_type === "true_false" && (
            <div role="radiogroup" aria-label={t("exam.trueOrFalse")} className="grid grid-cols-2 gap-3">
              {[true, false].map((value) => {
                const selected = answer !== undefined && answer !== null && String(answer) === String(value);
                return (
                  <button
                    key={String(value)}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setAnswer(question.id, value, question.question_type)}
                    className={`min-h-16 rounded-card border-2 p-4 text-lg font-bold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-200 ${
                      selected ? "border-primary-600 bg-primary-50 text-primary-800" : "border-line bg-surface text-ink hover:border-primary-300"
                    }`}
                  >
                    {value ? t("common.true") : t("common.false")}
                  </button>
                );
              })}
            </div>
          )}

          {question.question_type === "short_answer" && (
            <div>
              <label htmlFor={`answer-${question.id}`} className="mb-2 block text-sm font-semibold text-ink">
                {t("exam.yourAnswer")}
              </label>
              <textarea
                id={`answer-${question.id}`}
                value={answer ?? ""}
                onChange={(e) => setAnswer(question.id, e.target.value, question.question_type)}
                rows={5}
                className="w-full rounded-card border-2 border-line p-4 text-base focus:border-primary-600 focus:outline-none focus:ring-4 focus:ring-primary-100"
              />
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-6 rounded-control bg-warning-50 p-3 text-sm text-warning-700">
            {error}
          </p>
        )}
      </main>

      {/* Navigation: sticky at the bottom on mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface p-4 sm:static sm:border-0 sm:bg-transparent">
        <div className="mx-auto flex max-w-4xl justify-end">
          {isLast ? (
            <button type="button" onClick={() => setConfirmSubmit(true)} disabled={submitting} className="btn-primary w-full sm:w-auto">
              {submitting ? t("exam.submitting") : t("exam.submit")}
            </button>
          ) : (
            <button type="button" onClick={() => advance()} disabled={submitting} className="btn-primary w-full sm:w-auto">
              {t("exam.next")}
            </button>
          )}
        </div>
      </nav>

      {confirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="confirm-submit-title">
          <div className="w-full max-w-md rounded-t-2xl bg-surface p-6 sm:rounded-card">
            <h2 id="confirm-submit-title" className="text-lg font-bold text-ink">
              {t("exam.confirmTitle")}
            </h2>
            <p className="mt-2 text-ink-muted">{t("exam.confirmBody")}</p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" className="btn-secondary" onClick={() => setConfirmSubmit(false)}>
                {t("exam.keepWorking")}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setConfirmSubmit(false);
                  submit();
                }}
              >
                {t("exam.submitShort")}
              </button>
            </div>
          </div>
        </div>
      )}

      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/80" role="status">
          <LoadingSpinner size="lg" />
          <span className="ms-3 font-semibold text-ink-muted">{t("exam.submitting")}</span>
        </div>
      )}
    </div>
  );
}

function CenteredPanel({ children, dir = "ltr", lang }) {
  return (
    <div dir={dir} lang={lang} className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-lg rounded-card bg-surface p-6 text-center shadow-sm ring-1 ring-line sm:p-8">{children}</div>
    </div>
  );
}

/** Short summary right after submitting; the full results page has the details. */
function ResultSummary({ result, t, dir, lang }) {
  const stats = [
    { label: t("results.raw"), value: formatPercent(result.rawPercentage ?? result.percentage, 1, lang) },
    ...(result.adjustedPercentage !== null && result.adjustedPercentage !== undefined
      ? [{ label: t("results.adjusted"), value: formatPercent(result.adjustedPercentage, 1, lang) }]
      : []),
    { label: t("analytics.correct"), value: formatNumber(result.correctCount, undefined, lang) },
    { label: t("results.incorrect"), value: formatNumber(result.incorrectCount, undefined, lang) },
    { label: t("results.unanswered"), value: formatNumber(result.unansweredCount, undefined, lang) },
    { label: t("review.timeTaken"), value: formatDuration(result.timeTakenSeconds, lang) },
  ];

  return (
    <CenteredPanel dir={dir} lang={lang}>
      <FaCheckCircle className="mx-auto text-5xl text-success-700" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-bold text-ink">{t("exam.submittedTitle")}</h1>
      <p className="mt-1 text-ink-muted">{t("exam.submittedBody")}</p>
      <dl className="mt-6 grid grid-cols-2 gap-3 text-start sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-card bg-canvas p-3">
            <dt className="text-xs font-medium text-ink-subtle">{s.label}</dt>
            <dd className="mt-1 text-lg font-bold text-ink">{s.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link to={`/student/results/${result.assessmentId}`} className="btn-primary">
          {t("exam.seeResults")}
        </Link>
        <Link to="/student/dashboard" className="btn-secondary">
          {t("exam.backToDashboard")}
        </Link>
      </div>
    </CenteredPanel>
  );
}

export default TakeAssessment;
