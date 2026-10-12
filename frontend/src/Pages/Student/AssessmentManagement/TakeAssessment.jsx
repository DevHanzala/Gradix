import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { FaClock, FaCheckCircle, FaCloud, FaCloudUploadAlt, FaExclamationTriangle, FaWifi } from "react-icons/fa";
import useStudentAssessmentStore from "../../../store/studentAssessmentStore.js";
import LoadingSpinner from "../../../components/ui/LoadingSpinner";
import { Button } from "../../../components/ui";

const RTL_LANGUAGES = ["ur", "ar", "fa"];
const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ur", label: "اردو (Urdu)" },
  { value: "ar", label: "العربية (Arabic)" },
  { value: "fa", label: "فارسی (Persian)" },
];

const formatTime = (seconds) => {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
};

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

const SaveIndicator = ({ status }) => {
  const map = {
    saving: { icon: <FaCloudUploadAlt aria-hidden="true" />, text: "Saving…", cls: "text-warning-700 bg-warning-50" },
    saved: { icon: <FaCloud aria-hidden="true" />, text: "Saved", cls: "text-success-700 bg-success-50" },
    offline: { icon: <FaWifi aria-hidden="true" />, text: "Offline – will retry", cls: "text-danger-700 bg-danger-50" },
    error: { icon: <FaExclamationTriangle aria-hidden="true" />, text: "Not saved", cls: "text-danger-700 bg-danger-50" },
  };
  const item = map[status];
  if (!item) return null;
  return (
    <span role="status" aria-live="polite" className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${item.cls}`}>
      {item.icon}
      {item.text}
    </span>
  );
};

function TakeAssessment() {
  const { assessmentId } = useParams();
  const {
    phase,
    questions,
    answers,
    currentIndex,
    questionDeadline,
    overallDeadline,
    language,
    saveStatus,
    result,
    error,
    errorCode,
    loadAttempt,
    startAssessment,
    setAnswer,
    advance,
    submit,
    flushPending,
    reset,
  } = useStudentAssessmentStore();

  const [selectedLanguage, setSelectedLanguage] = useState("en");
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

  const inProgress = phase === "in_progress";
  const now = useNow(inProgress);
  const questionRemaining = inProgress ? Math.ceil((questionDeadline - now) / 1000) : 0;
  const overallRemaining = inProgress ? Math.ceil((overallDeadline - now) / 1000) : 0;
  const isLast = currentIndex >= questions.length - 1;

  // Per-question timeout auto-advances (last question auto-submits);
  // overall timeout auto-submits. Fire once per question index.
  useEffect(() => {
    if (!inProgress || questions.length === 0) return;
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
  }, [inProgress, questionRemaining, overallRemaining, currentIndex, questions.length, advance, submit]);

  const dir = RTL_LANGUAGES.includes(inProgress ? language : selectedLanguage) ? "rtl" : "ltr";

  // ---------------------------------------------------------------- states

  if (phase === "idle" || phase === "loading") {
    return (
      <CenteredPanel>
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-ink-muted">Loading assessment…</p>
      </CenteredPanel>
    );
  }

  if (phase === "error") {
    return (
      <CenteredPanel>
        <FaExclamationTriangle className="mx-auto text-4xl text-danger-600" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-bold text-ink">
          {errorCode === "NOT_ENROLLED" ? "You are not enrolled in this assessment" : "Something went wrong"}
        </h1>
        <p className="mt-2 text-ink-muted">{error}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => loadAttempt(assessmentId)} className="btn-secondary">
            Try again
          </button>
          <Link to="/student/dashboard" className="btn-primary">
            Back to dashboard
          </Link>
        </div>
      </CenteredPanel>
    );
  }

  if (phase === "completed" && result) {
    return <ResultSummary result={result} />;
  }

  if (phase === "not_started" || phase === "starting") {
    const starting = phase === "starting";
    return (
      <CenteredPanel dir={dir}>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Ready to begin?</h1>
        <p className="mt-2 text-ink-muted">Choose the language for your questions, then start.</p>

        <div className="mt-6 text-start">
          <label htmlFor="exam-language" className="mb-2 block text-sm font-semibold text-ink">
            Question language
          </label>
          <select
            id="exam-language"
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            disabled={starting}
            className="w-full min-h-11 rounded-control border border-line-strong bg-surface px-3 py-2 text-base focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <ul className="mt-6 space-y-2 rounded-control bg-primary-50 p-4 text-start text-sm text-primary-800">
          <li>• Each question has its own timer. When it runs out you move on automatically.</li>
          <li>• You cannot go back to a previous question.</li>
          <li>• Your answers are saved automatically as you choose them.</li>
          <li>• You can take this assessment only once. If you refresh, you continue where you left off.</li>
        </ul>

        {error && (
          <p role="alert" className="mt-4 rounded-control bg-danger-50 p-3 text-sm text-danger-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => startAssessment(assessmentId, selectedLanguage)}
          disabled={starting}
          className="btn-primary mt-6 w-full"
        >
          {starting ? (
            <>
              <LoadingSpinner size="sm" color="white" />
              <span>Preparing your questions…</span>
            </>
          ) : (
            "Start assessment"
          )}
        </button>
      </CenteredPanel>
    );
  }

  // ------------------------------------------------------------ exam view

  const question = questions[currentIndex];
  if (!question) {
    return (
      <CenteredPanel>
        <LoadingSpinner size="lg" />
      </CenteredPanel>
    );
  }
  const answer = answers[question.id];
  const submitting = phase === "submitting";

  return (
    <div dir={dir} className="flex min-h-screen flex-col bg-canvas">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <span className="text-sm font-semibold text-ink-muted">
            Question {currentIndex + 1} / {questions.length}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <SaveIndicator status={saveStatus} />
            <span
              className={`inline-flex items-center gap-1.5 rounded-control px-3 py-1.5 text-sm font-bold tabular-nums ${
                questionRemaining <= 10 ? "bg-danger-600 text-white" : "bg-primary-600 text-white"
              }`}
              aria-label={`Time left for this question: ${formatTime(questionRemaining)}`}
            >
              <FaClock aria-hidden="true" />
              {formatTime(questionRemaining)}
            </span>
            <span className="rounded-control bg-gray-100 px-3 py-1.5 text-sm font-semibold tabular-nums text-ink-muted">
              Total {formatTime(overallRemaining)}
            </span>
          </div>
        </div>
        <div className="h-1 bg-gray-100" aria-hidden="true">
          <div
            className="h-1 bg-primary-600 transition-all"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </header>

      {/* Question */}
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-32 pt-6 sm:pb-12">
        <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold">
          <span dir="ltr" className="rounded-full bg-success-50 px-3 py-1 text-success-700">+{question.positive_marks} correct</span>
          {question.negative_marks > 0 && (
            <span dir="ltr" className="rounded-full bg-danger-50 px-3 py-1 text-danger-700">−{question.negative_marks} wrong</span>
          )}
        </div>

        <h1 className="text-xl font-semibold leading-relaxed text-ink sm:text-2xl">{question.question_text}</h1>

        <div className="mt-6">
          {question.question_type === "multiple_choice" && (
            <div role="radiogroup" aria-label="Answer options" className="grid gap-3 sm:grid-cols-2">
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
            <div role="radiogroup" aria-label="True or false" className="grid grid-cols-2 gap-3">
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
                    {value ? "True" : "False"}
                  </button>
                );
              })}
            </div>
          )}

          {question.question_type === "short_answer" && (
            <div>
              <label htmlFor={`answer-${question.id}`} className="mb-2 block text-sm font-semibold text-ink">
                Your answer
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
              {submitting ? "Submitting…" : "Submit assessment"}
            </button>
          ) : (
            <button type="button" onClick={() => advance()} disabled={submitting} className="btn-primary w-full sm:w-auto">
              Next question
            </button>
          )}
        </div>
      </nav>

      {confirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="confirm-submit-title">
          <div className="w-full max-w-md rounded-t-2xl bg-surface p-6 sm:rounded-card">
            <h2 id="confirm-submit-title" className="text-lg font-bold text-ink">
              Submit your assessment?
            </h2>
            <p className="mt-2 text-ink-muted">You cannot change your answers after submitting.</p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" className="btn-secondary" onClick={() => setConfirmSubmit(false)}>
                Keep working
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setConfirmSubmit(false);
                  submit();
                }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/80" role="status">
          <LoadingSpinner size="lg" />
          <span className="ms-3 font-semibold text-ink-muted">Submitting…</span>
        </div>
      )}
    </div>
  );
}

function CenteredPanel({ children, dir = "ltr" }) {
  return (
    <div dir={dir} className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-lg rounded-card bg-surface p-6 text-center shadow-sm ring-1 ring-line sm:p-8">{children}</div>
    </div>
  );
}

function ResultSummary({ result }) {
  const minutes = Math.floor((result.timeTakenSeconds || 0) / 60);
  const seconds = (result.timeTakenSeconds || 0) % 60;
  const stats = [
    { label: "Score", value: `${result.score} / ${result.totalMarks}` },
    { label: "Percentage", value: `${result.percentage}%` },
    { label: "Correct", value: result.correctCount },
    { label: "Incorrect", value: result.incorrectCount },
    { label: "Unanswered", value: result.unansweredCount },
    { label: "Time taken", value: `${minutes}m ${seconds}s` },
  ];

  return (
    <CenteredPanel>
      <FaCheckCircle className="mx-auto text-5xl text-success-700" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-bold text-ink">Assessment submitted</h1>
      <p className="mt-1 text-ink-muted">Here is how you did.</p>
      <dl className="mt-6 grid grid-cols-2 gap-3 text-start sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-card bg-canvas p-3">
            <dt className="text-xs font-medium text-ink-subtle">{s.label}</dt>
            <dd className="mt-1 text-lg font-bold text-ink">{s.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link to={`/student/analytics?assessment=${result.assessmentId}`} className="btn-primary">
          Review answers
        </Link>
        <Link to="/student/dashboard" className="btn-secondary">
          Back to dashboard
        </Link>
      </div>
    </CenteredPanel>
  );
}

export default TakeAssessment;
