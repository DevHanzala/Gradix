import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaArrowRight, FaCheckCircle, FaPause, FaTimesCircle } from "react-icons/fa";
import { answerLiveApi, fetchLiveMeApi, nextLiveApi, respondPollApi } from "../../api/live.api.js";
import { openLiveSocket } from "../../lib/liveSocket.js";
import { forgetLiveToken, liveTokenFor } from "../../utils/liveTokens.js";
import { errorMessage } from "../../utils/forms.js";
import { formatNumber } from "../../utils/format.js";
import { textDirection } from "../../utils/text.js";
import LiveTimer from "../../components/live/LiveTimer.jsx";
import LanguageSwitcher from "../../components/LanguageSwitcher.jsx";
import { Alert, Button, Card, CardBody, PageSpinner } from "../../components/ui";
import Leaderboard from "../../components/live/Leaderboard.jsx";
import Podium from "../../components/live/Podium.jsx";
import { BlankStem, FillBlankInput, MatchingInput, QuestionImage, StructuredAnswer } from "../../components/questions/QuestionParts.jsx";
import PollResponder from "../../components/live/PollResponder.jsx";
import TeamRace from "../../components/live/TeamRace.jsx";
import { liveSounds } from "../../utils/liveSounds.js";

const optionLabel = (t, option) => (option === true || option === "true" ? t("common.true") : option === false || option === "false" ? t("common.false") : option);

/** One participant's live screen: lobby, question, answer, reveal, results. */
function LivePlay() {
  const { t } = useTranslation();
  const { sessionId } = useParams();
  const token = liveTokenFor(sessionId);
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [gone, setGone] = useState(null); // "removed" | "expired"
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState(null);
  const lastPublic = useRef(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetchLiveMeApi(token);
      setState(res.data.data);
      lastPublic.current = res.data.data.session;
      setError(null);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 403) setGone("removed");
      else if (status === 401) setGone("expired");
      else setError(errorMessage(e, t("live.loadFailed")));
    }
  }, [token, t]);

  useEffect(() => {
    load();
  }, [load]);

  // Pushes from the server; refetch only when what this participant sees has changed.
  useEffect(() => {
    if (!token) return undefined;
    const socket = openLiveSocket({ liveToken: token });
    socket.on("connect", load);
    socket.on("live:state", (s) => {
      const prev = lastPublic.current;
      const changed = !prev || prev.status !== s.status || prev.currentIndex !== s.currentIndex || prev.phase !== s.phase || prev.questionDeadline !== s.questionDeadline;
      if (changed || s.kind === "poll" || s.kind === "teams") load();
    });
    socket.on("live:removed", () => setGone("removed"));
    return () => socket.close();
  }, [token, load]);

  // Student-paced: look again when this question's time runs out (shows the answer).
  useEffect(() => {
    if (!state?.deadline || state.session.pacing !== "student" || state.myAnswer) return undefined;
    // Time left by the server's clock at the moment of the last response.
    const wait = new Date(state.deadline).getTime() - new Date(state.session.serverNow).getTime() + 300;
    const id = setTimeout(load, Math.max(300, wait));
    return () => clearTimeout(id);
  }, [state, load]);

  // A new question clears the typed answer and the last feedback.
  const questionKey = state?.question ? `${state.question.index}` : "none";
  useEffect(() => {
    setDraft("");
    setFeedback(null);
  }, [questionKey]);

  // Sounds (when the session has them on): right/wrong at reveal, a fanfare at the end.
  const soundKey = state ? `${state.session.status}-${state.question?.index}-${Boolean(state.reveal)}` : "";
  const lastSound = useRef(null);
  useEffect(() => {
    if (!state?.session.settings.sounds || lastSound.current === soundKey) return;
    lastSound.current = soundKey;
    if (state.session.status === "ended" && state.session.settings.game) liveSounds.fanfare();
    else if (state.reveal && state.myAnswer) (state.myAnswer.correct ? liveSounds.correct : liveSounds.wrong)();
  }, [soundKey, state]);

  const answerPoll = async (answer) => {
    try {
      await respondPollApi(token, state.poll.id, answer);
      await load();
      return null;
    } catch (e) {
      await load();
      return errorMessage(e, t("live.pollFailed"));
    }
  };

  const submit = async (answer) => {
    if (busy || state?.myAnswer) return;
    setBusy(true);
    try {
      const res = await answerLiveApi(token, state.question.index, answer);
      setFeedback(res.data.data);
      await load();
    } catch (e) {
      setError(errorMessage(e, t("live.answerFailed")));
      await load();
    } finally {
      setBusy(false);
    }
  };

  const next = async () => {
    setBusy(true);
    try {
      setState((await nextLiveApi(token)).data.data);
    } catch (e) {
      setError(errorMessage(e, t("live.loadFailed")));
    } finally {
      setBusy(false);
    }
  };

  const shell = (children) => (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-ink">{state?.session.title || t("live.liveSession")}</p>
          {state?.me && (
            <p className="truncate text-sm text-ink-muted">
              {state.me.nickname}
              {state.me.team && ` · ${t("live.teamName", { n: state.me.team })}`}
              {state.session.settings.game && ` · ${t("live.points", { count: state.me.points, value: formatNumber(state.me.points) })}`}
            </p>
          )}
        </div>
        <LanguageSwitcher />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        {state?.poll && <PollResponder key={state.poll.id} poll={state.poll} sessionLanguage={state.session.language} onSubmit={answerPoll} />}
        {children}
        {state?.teams?.length > 0 && (
          <div className="mt-6">
            <TeamRace teams={state.teams} myTeam={state.me.team} />
          </div>
        )}
      </main>
    </div>
  );

  if (!token || gone) {
    return shell(
      <Alert tone={gone === "removed" ? "danger" : "warning"} title={gone === "removed" ? t("live.removedTitle") : t("live.expiredTitle")}>
        <p>{gone === "removed" ? t("live.removedBody") : t("live.expiredBody")}</p>
        <Button className="mt-3" to="/join" onClick={() => forgetLiveToken(sessionId)}>
          {t("live.joinAgain")}
        </Button>
      </Alert>
    );
  }
  if (!state) return error ? shell(<Alert tone="danger">{error}</Alert>) : <PageSpinner label={t("common.loading")} />;

  const { session, question, myAnswer, reveal, me } = state;
  const answeredCount = t("live.yourTotals", { correct: formatNumber(me.correct), answered: formatNumber(me.answered) });

  if (session.status === "lobby") {
    return shell(
      <Card>
        <CardBody className="py-12 text-center">
          <p className="text-2xl font-bold text-ink">{t("live.youreIn", { name: me.nickname })}</p>
          <p className="mt-2 text-ink-muted">{t("live.waitingForTeacher")}</p>
        </CardBody>
      </Card>
    );
  }

  if (session.status === "ended" || state.finished) {
    return shell(
      <Card>
        <CardBody className="py-10 text-center">
          <FaCheckCircle aria-hidden="true" className="mx-auto text-5xl text-success-600" />
          <p className="mt-3 text-2xl font-bold text-ink">{session.status === "ended" ? t("live.sessionEnded") : t("live.youFinished")}</p>
          <p className="mt-2 text-lg text-ink-muted">{answeredCount}</p>
          {session.settings.game && <p className="mt-1 text-lg font-semibold text-primary-700">{t("live.points", { count: me.points, value: formatNumber(me.points) })}</p>}
          {session.status === "ended" && session.settings.game ? (
            <Podium rows={state.leaderboard} />
          ) : (
            <Leaderboard rows={state.leaderboard} highlightId={me.id} />
          )}
          {state.finished && session.status !== "ended" && <p className="mt-4 text-sm text-ink-muted">{t("live.waitForOthers")}</p>}
        </CardBody>
      </Card>
    );
  }

  const paused = session.status === "paused";
  const closed = session.pacing === "teacher" && session.phase === "closed";
  const options = question?.type === "multiple_choice" ? question.options : question?.type === "true_false" ? [true, false] : null;
  const chosen = myAnswer?.answer;
  const correctAnswer = reveal?.correctAnswer;

  return shell(
    <>
      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}
      {!question ? (
        <Card>
          <CardBody className="py-12 text-center text-ink-muted">{t("live.getReady")}</CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody>
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm font-semibold text-ink-muted">
                {t("live.questionOf", { index: formatNumber(question.index + 1), total: formatNumber(session.questionCount) })}
              </p>
              {!reveal && !closed && (
                <LiveTimer
                  key={`${question.index}-${state.deadline}`}
                  deadline={state.deadline}
                  serverNow={session.serverNow}
                  paused={paused}
                  pausedRemainingMs={session.pausedRemainingMs}
                />
              )}
            </div>
            <h1 className="mt-3 text-xl font-bold leading-relaxed text-ink sm:text-2xl" dir={textDirection(question.text)}>
              {question.type === "fill_blank" ? <BlankStem text={question.text} /> : question.text}
            </h1>
            <QuestionImage image={question.image} />

            {paused && (
              <Alert tone="info" className="mt-4" title={t("live.pausedTitle")}>
                <FaPause aria-hidden="true" className="me-2 inline" />
                {t("live.pausedBody")}
              </Alert>
            )}

            {["fill_blank", "matching"].includes(question.type) ? (
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit(draft);
                }}
              >
                {myAnswer ? (
                  <StructuredAnswer question={{ question_type: question.type, options: question.options }} answer={chosen} />
                ) : question.type === "fill_blank" ? (
                  <FillBlankInput text={question.text} value={draft || []} onChange={setDraft} disabled={paused || closed} size="md" />
                ) : (
                  <MatchingInput options={question.options} value={draft || {}} onChange={setDraft} disabled={paused || closed} />
                )}
                {!myAnswer && (
                  <Button type="submit" loading={busy} disabled={!draft || paused || closed}>
                    {t("live.submitAnswer")}
                  </Button>
                )}
                {reveal && (
                  <p className="font-semibold text-success-700">
                    {t("live.correctAnswer")}: {String(correctAnswer)}
                  </p>
                )}
              </form>
            ) : options ? (
              <div role="radiogroup" aria-label={t("exam.answerOptions")} className="mt-6 grid gap-3 sm:grid-cols-2">
                {options.map((option, i) => {
                  const selected = chosen !== undefined && String(chosen) === String(option);
                  const isRight = reveal && String(correctAnswer) === String(option);
                  const isWrongPick = reveal && selected && !isRight;
                  return (
                    <button
                      key={`${option}`}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={Boolean(myAnswer) || busy || paused || closed}
                      onClick={() => submit(option)}
                      className={`flex min-h-16 items-start gap-3 rounded-card border-2 p-4 text-start text-lg transition focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-200 disabled:cursor-default ${
                        isRight
                          ? "border-success-600 bg-success-50"
                          : isWrongPick
                            ? "border-danger-600 bg-danger-50"
                            : selected
                              ? "border-primary-600 bg-primary-50"
                              : "border-line bg-surface enabled:hover:border-primary-300"
                      }`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-ink-muted">
                        {question.type === "multiple_choice" ? String.fromCharCode(65 + i) : i === 0 ? "✓" : "✗"}
                      </span>
                      <span className="pt-0.5" dir={textDirection(String(optionLabel(t, option)))}>
                        {optionLabel(t, option)}
                        <QuestionImage image={question.optionImages?.[i]} className="mt-2 max-h-28 w-auto max-w-full rounded-control" />
                      </span>
                      {isRight && <FaCheckCircle aria-label={t("live.correctAnswer")} className="ms-auto mt-1 shrink-0 text-success-600" />}
                      {isWrongPick && <FaTimesCircle aria-label={t("live.yourWrongAnswer")} className="ms-auto mt-1 shrink-0 text-danger-600" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <form
                className="mt-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (draft.trim()) submit(draft.trim());
                }}
              >
                <label htmlFor="live-answer" className="mb-2 block text-sm font-semibold text-ink">
                  {t("exam.yourAnswer")}
                </label>
                <textarea
                  id="live-answer"
                  value={myAnswer ? String(chosen ?? "") : draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={Boolean(myAnswer) || paused || closed}
                  rows={3}
                  className="w-full rounded-control border border-line-strong p-3 text-lg"
                />
                {!myAnswer && (
                  <Button type="submit" className="mt-3" loading={busy} disabled={!draft.trim() || paused || closed}>
                    {t("live.submitAnswer")}
                  </Button>
                )}
                {reveal && (
                  <p className="mt-3 font-semibold text-success-700">
                    {t("live.correctAnswer")}: <span dir={textDirection(String(correctAnswer))}>{String(correctAnswer)}</span>
                  </p>
                )}
              </form>
            )}

            <div aria-live="polite" className="mt-5">
              {myAnswer && !reveal && <Alert tone="info">{t("live.answerReceived")}</Alert>}
              {!myAnswer && closed && <Alert tone="warning">{t("live.timeUp")}</Alert>}
              {reveal && myAnswer && (
                <Alert tone={myAnswer.correct ? "success" : "danger"} title={myAnswer.correct ? t("live.youWereRight") : t("live.youWereWrong")}>
                  {session.settings.game && myAnswer.correct && t("live.pointsEarned", { value: formatNumber(myAnswer.points ?? feedback?.points ?? 0) })}
                </Alert>
              )}
              {reveal && !myAnswer && <Alert tone="warning">{t("live.noAnswerGiven")}</Alert>}
            </div>

            {session.pacing === "student" && (myAnswer || reveal) && (
              <Button className="mt-5" size="lg" icon={FaArrowRight} onClick={next} loading={busy}>
                {question.index + 1 >= session.questionCount ? t("live.finish") : t("live.nextQuestion")}
              </Button>
            )}
            {session.pacing === "teacher" && reveal && <p className="mt-4 text-sm text-ink-muted">{t("live.waitForNext")}</p>}
          </CardBody>
        </Card>
      )}
      {session.pacing === "teacher" && reveal && <Leaderboard rows={state.leaderboard} highlightId={me.id} />}
      <p className="mt-6 text-center text-sm text-ink-muted">{answeredCount}</p>
      {!me.guest ? null : (
        <p className="mt-2 text-center text-xs text-ink-subtle">
          {t("live.guestFooter")} <Link to="/signup" className="text-primary-700 underline">{t("auth.createAccountLink")}</Link>
        </p>
      )}
    </>
  );
}

export default LivePlay;
