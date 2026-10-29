import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { fetchLiveSessionApi } from "../../../api/live.api.js";
import { openLiveSocket } from "../../../lib/liveSocket.js";
import { errorMessage } from "../../../utils/forms.js";
import { formatNumber } from "../../../utils/format.js";
import { textDirection } from "../../../utils/text.js";
import AnswerBars from "../../../components/live/AnswerBars.jsx";
import JoinInfo from "../../../components/live/JoinInfo.jsx";
import LiveTimer from "../../../components/live/LiveTimer.jsx";
import Leaderboard from "../../../components/live/Leaderboard.jsx";
import { optionsFor } from "../../../components/live/liveOptions.js";
import { Alert, PageSpinner } from "../../../components/ui";

/**
 * Projector view: large type, no navigation, no answers until the teacher reveals.
 * Opened from the live board in a second window; it follows the session on its own.
 */
function LiveProjector() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [view, setView] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setView((await fetchLiveSessionApi(id)).data.data);
    } catch (e) {
      setError(errorMessage(e, t("live.loadFailed")));
    }
  }, [id, t]);

  useEffect(() => {
    load();
    const socket = openLiveSocket({ token: localStorage.getItem("token") });
    socket.on("connect", () => socket.emit("live:watch", Number(id)));
    socket.on("live:board", setView);
    return () => socket.close();
  }, [id, load]);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!view) return <PageSpinner label={t("common.loading")} />;

  const { session, participants, current } = view;
  const teacherPaced = session.pacing === "teacher";
  const revealed = session.phase === "reveal";
  const answered = participants.filter((p) => p.answeredCurrent).length;

  return (
    <div className="flex min-h-screen flex-col bg-canvas px-6 py-8 sm:px-12">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-ink sm:text-4xl">{session.title}</h1>
        {session.status !== "ended" && (
          <p className="text-2xl text-ink-muted">
            {t("live.code")}: <span className="font-bold tracking-widest text-ink tabular-nums" dir="ltr">{session.code}</span>
          </p>
        )}
      </header>

      {session.status === "lobby" && (
        <main className="flex flex-1 flex-col items-center justify-center gap-8">
          <JoinInfo code={session.code} large />
          <p className="text-3xl font-semibold text-ink">{t("live.joinedCount", { count: participants.length, value: formatNumber(participants.length) })}</p>
          <ul className="flex max-w-5xl flex-wrap justify-center gap-3" aria-label={t("live.participants")}>
            {participants.map((p) => (
              <li key={p.id} className="rounded-full bg-primary-50 px-4 py-2 text-xl font-semibold text-primary-800">
                {p.nickname}
              </li>
            ))}
          </ul>
        </main>
      )}

      {session.status !== "lobby" && session.status !== "ended" && teacherPaced && current && (
        <main className="flex-1">
          <div className="mb-6 flex items-center justify-between gap-6">
            <p className="text-2xl font-semibold text-ink-muted">
              {t("live.questionOf", { index: formatNumber(current.index + 1), total: formatNumber(session.questionCount) })}
            </p>
            {session.status === "running" && session.phase === "question" && (
              <LiveTimer key={session.questionDeadline} deadline={session.questionDeadline} serverNow={session.serverNow} size="lg" />
            )}
          </div>
          {current.question && (
            <p className="mb-10 text-4xl font-bold leading-snug text-ink sm:text-5xl" dir={textDirection(current.question.text)}>
              {current.question.text}
            </p>
          )}
          {revealed && current.question ? (
            <AnswerBars large options={optionsFor(current.question)} distribution={current.distribution} correct={current.question.correctAnswer} />
          ) : current.question?.options ? (
            <ol className="grid gap-4 sm:grid-cols-2">
              {current.question.options.map((o, i) => (
                <li key={o} className="flex items-start gap-4 rounded-card border-2 border-line bg-surface p-5 text-2xl">
                  <span className="font-bold text-primary-700">{String.fromCharCode(65 + i)}</span>
                  <span dir={textDirection(o)}>{o}</span>
                </li>
              ))}
            </ol>
          ) : null}
          <p className="mt-8 text-2xl text-ink-muted">{t("live.answeredOf", { answered: formatNumber(answered), total: formatNumber(participants.length) })}</p>
          {revealed && session.settings.game && session.settings.showLeaderboard && <Leaderboard rows={view.leaderboard} large />}
        </main>
      )}

      {session.status !== "lobby" && session.status !== "ended" && !teacherPaced && (
        <main className="flex-1">
          <p className="mb-6 text-3xl font-semibold text-ink">{t("live.studentPacedProgress")}</p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {participants.map((p) => (
              <li key={p.id} className="rounded-card border border-line bg-surface p-4 text-xl">
                <span className="font-semibold">{p.nickname}</span>
                <span className="ms-2 text-ink-muted">
                  {p.finished ? t("live.finished") : t("live.onQuestion", { index: formatNumber(p.currentIndex + 1) })}
                </span>
              </li>
            ))}
          </ul>
        </main>
      )}

      {session.status === "ended" && (
        <main className="flex flex-1 flex-col items-center justify-center">
          <p className="text-5xl font-bold text-ink">{t("live.sessionEnded")}</p>
          {session.settings.game && session.settings.showLeaderboard && <Leaderboard rows={view.leaderboard} large />}
        </main>
      )}
    </div>
  );
}

export default LiveProjector;
