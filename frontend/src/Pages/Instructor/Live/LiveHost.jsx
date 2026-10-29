import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaDesktop, FaEye, FaFileCsv, FaForward, FaPause, FaPlay, FaStop, FaUserMinus } from "react-icons/fa";
import { closePollApi, controlLiveSessionApi, exportLiveCsvApi, fetchLiveSessionApi, openPollApi, removeLiveParticipantApi, setTeamApi } from "../../../api/live.api.js";
import { openLiveSocket } from "../../../lib/liveSocket.js";
import { errorMessage } from "../../../utils/forms.js";
import { formatNumber } from "../../../utils/format.js";
import { textDirection } from "../../../utils/text.js";
import AnswerBars from "../../../components/live/AnswerBars.jsx";
import JoinInfo from "../../../components/live/JoinInfo.jsx";
import LiveTimer from "../../../components/live/LiveTimer.jsx";
import Leaderboard from "../../../components/live/Leaderboard.jsx";
import PollComposer from "../../../components/live/PollComposer.jsx";
import PollResults from "../../../components/live/PollResults.jsx";
import TeamRace from "../../../components/live/TeamRace.jsx";
import { optionsFor } from "../../../components/live/liveOptions.js";
import { Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState, Modal, PageHeader, ResponsiveTable, SkeletonList, StatCard } from "../../../components/ui";

/** The teacher's live board: join info, controls, who answered, results per question. */
function LiveHost() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [view, setView] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [pollBusy, setPollBusy] = useState(false);
  const [pollError, setPollError] = useState(null);

  const launchPoll = async (body) => {
    setPollBusy(true);
    setPollError(null);
    try {
      await openPollApi(id, body);
      await load();
      return true;
    } catch (e) {
      setPollError(errorMessage(e, t("live.pollLaunchFailed")));
      return false;
    } finally {
      setPollBusy(false);
    }
  };
  const closePoll = async (pollId) => {
    try {
      await closePollApi(id, pollId);
      await load();
    } catch (e) {
      setPollError(errorMessage(e, t("live.actionFailed")));
    }
  };
  const moveTeam = async (participantId, team) => {
    try {
      setView((await setTeamApi(id, participantId, team)).data.data);
    } catch (e) {
      setError(errorMessage(e, t("live.actionFailed")));
    }
  };

  const load = useCallback(async () => {
    try {
      setView((await fetchLiveSessionApi(id)).data.data);
      setError(null);
    } catch (e) {
      setError(errorMessage(e, t("live.loadFailed")));
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const socket = openLiveSocket({ token: localStorage.getItem("token") });
    const watch = () => socket.emit("live:watch", Number(id));
    socket.on("connect", watch);
    socket.on("live:board", (board) => setView(board));
    return () => socket.close();
  }, [id]);

  const control = async (action) => {
    setBusy(action);
    try {
      setView((await controlLiveSessionApi(id, action)).data.data);
      setError(null);
    } catch (e) {
      setError(errorMessage(e, t("live.actionFailed")));
    } finally {
      setBusy(null);
      setConfirmEnd(false);
    }
  };

  const remove = async () => {
    try {
      setView((await removeLiveParticipantApi(id, removing.id)).data.data);
    } catch (e) {
      setError(errorMessage(e, t("live.actionFailed")));
    } finally {
      setRemoving(null);
    }
  };

  const exportCsv = async () => {
    try {
      const res = await exportLiveCsvApi(id);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `live-session-${view.session.code}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(errorMessage(e, t("live.actionFailed")));
    }
  };

  if (!view) {
    return (
      <>
        <PageHeader title={t("live.liveSession")} backTo="/instructor/live" backLabel={t("live.title")} />
        {error ? <Alert tone="danger">{error}</Alert> : <SkeletonList rows={5} />}
      </>
    );
  }

  const { session, participants, perQuestion, current } = view;
  const teacherPaced = session.pacing === "teacher";
  const ended = session.status === "ended";
  const struggling = participants.filter((p) => p.struggling);
  const answeredNow = participants.filter((p) => p.answeredCurrent).length;
  const overall = perQuestion.reduce((acc, q) => ({ answered: acc.answered + q.answered, correct: acc.correct + q.correct }), { answered: 0, correct: 0 });
  const phaseLabel = session.status === "running" && teacherPaced ? t(`live.phase.${session.phase}`) : t(`live.status.${session.status}`);

  const controls = (
    <div className="flex flex-wrap gap-2">
      {session.status === "lobby" && (
        <Button icon={FaPlay} onClick={() => control("start")} loading={busy === "start"} disabled={!participants.length}>
          {t("live.start")}
        </Button>
      )}
      {teacherPaced && session.status === "running" && ["question", "closed"].includes(session.phase) && (
        <Button icon={FaEye} onClick={() => control("reveal")} loading={busy === "reveal"}>
          {t("live.reveal")}
        </Button>
      )}
      {teacherPaced && session.status === "running" && session.phase === "reveal" && (
        <Button icon={FaForward} onClick={() => control("next")} loading={busy === "next"}>
          {session.currentIndex + 1 >= session.questionCount ? t("live.finishSession") : t("live.next")}
        </Button>
      )}
      {teacherPaced && session.status === "running" && session.phase === "question" && (
        <Button variant="secondary" icon={FaPause} onClick={() => control("pause")} loading={busy === "pause"}>
          {t("live.pause")}
        </Button>
      )}
      {session.status === "paused" && (
        <Button icon={FaPlay} onClick={() => control("resume")} loading={busy === "resume"}>
          {t("live.resume")}
        </Button>
      )}
      {!ended && (
        <Button variant="danger" icon={FaStop} onClick={() => setConfirmEnd(true)}>
          {t("live.end")}
        </Button>
      )}
      <Button variant="secondary" icon={FaDesktop} href={`/instructor/live/${id}/projector`} target="_blank" rel="noopener">
        {t("live.projector")}
      </Button>
      <Button variant="secondary" icon={FaFileCsv} onClick={exportCsv}>
        {t("live.exportCsv")}
      </Button>
    </div>
  );

  return (
    <>
      <PageHeader title={session.title} description={`${phaseLabel} · ${teacherPaced ? t("live.teacherPaced") : t("live.studentPaced")}`} backTo="/instructor/live" backLabel={t("live.title")} />
      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardBody>{!ended ? <JoinInfo code={session.code} /> : <p className="text-ink-muted">{t("live.sessionEnded")}</p>}</CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardBody className="space-y-4">
            {controls}
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label={t("live.participants")} value={formatNumber(participants.length)} />
              <StatCard label={t("live.answeredNow")} value={teacherPaced && current ? `${formatNumber(answeredNow)} / ${formatNumber(participants.length)}` : "–"} />
              <StatCard label={t("live.percentCorrect")} value={overall.answered ? `${formatNumber(Math.round((100 * overall.correct) / overall.answered))}%` : "–"} />
            </div>
            {session.status === "lobby" && !participants.length && <Alert tone="info">{t("live.waitingForParticipants")}</Alert>}
          </CardBody>
        </Card>
      </div>

      {teacherPaced && current && !ended && (
        <Card className="mb-6">
          <CardHeader
            title={t("live.questionOf", { index: formatNumber(current.index + 1), total: formatNumber(session.questionCount) })}
            actions={
              session.status === "running" && session.phase === "question" ? (
                <LiveTimer key={session.questionDeadline} deadline={session.questionDeadline} serverNow={session.serverNow} />
              ) : (
                <Badge tone={session.phase === "reveal" ? "success" : "warning"}>{phaseLabel}</Badge>
              )
            }
          />
          <CardBody>
            {current.question ? (
              <>
                <p className="mb-4 text-lg font-semibold text-ink" dir={textDirection(current.question.text)}>
                  {current.question.text}
                </p>
                <AnswerBars options={optionsFor(current.question)} distribution={current.distribution} correct={current.question.correctAnswer} />
              </>
            ) : (
              <p className="text-ink-muted">{t("live.uniqueQuestionsNote", { answered: formatNumber(current.answered), correct: formatNumber(current.correct) })}</p>
            )}
          </CardBody>
        </Card>
      )}

      {session.settings.game && <Leaderboard rows={view.leaderboard} />}

      {view.teams?.length > 0 && (
        <Card className="my-6">
          <CardBody>
            <TeamRace teams={view.teams} />
          </CardBody>
        </Card>
      )}

      <div className="my-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("live.quickPoll")} description={t("live.quickPollHint")} />
          <CardBody>{ended ? <p className="text-ink-muted">{t("live.sessionEnded")}</p> : <PollComposer onLaunch={launchPoll} busy={pollBusy} error={pollError} />}</CardBody>
        </Card>
        <Card>
          <CardHeader title={t("live.pollResultsTitle")} />
          <CardBody className="space-y-6">
            {!view.polls?.length && <p className="text-ink-muted">{t("live.noPollsYet")}</p>}
            {[...(view.polls || [])].reverse().map((poll) => (
              <section key={poll.id} className="border-b border-line pb-4 last:border-0">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <Badge tone={poll.status === "open" ? "success" : "neutral"}>
                    {poll.kind === "exit_ticket" ? t("live.exitTicket") : t(`live.pollKind.${poll.kind}`)} · {poll.status === "open" ? t("live.pollOpen") : t("live.pollClosed")}
                  </Badge>
                  {poll.status === "open" && (
                    <Button variant="secondary" onClick={() => closePoll(poll.id)}>
                      {t("live.closePoll")}
                    </Button>
                  )}
                </div>
                <PollResults poll={poll} />
              </section>
            ))}
          </CardBody>
        </Card>
      </div>

      {struggling.length > 0 && (
        <Alert tone="warning" title={t("live.strugglingTitle", { count: struggling.length })} className="my-6">
          {struggling.map((p) => p.nickname).join(" · ")}
        </Alert>
      )}

      <Card className="my-6">
        <CardHeader title={t("live.participants")} />
        {participants.length === 0 ? (
          <EmptyState title={t("live.noParticipants")} description={t("live.noParticipantsHint")} />
        ) : (
          <ResponsiveTable
            caption={t("live.participants")}
            rows={participants}
            columns={[
              {
                key: "nickname",
                header: t("live.nickname"),
                render: (p) => (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{p.nickname}</span>
                    {p.guest && <Badge>{t("live.guest")}</Badge>}
                    {p.struggling && <Badge tone="warning">{t("live.struggling")}</Badge>}
                  </span>
                ),
              },
              {
                key: "progress",
                header: teacherPaced ? t("live.answeredCurrent") : t("live.progress"),
                render: (p) =>
                  teacherPaced
                    ? p.answeredCurrent
                      ? t("common.yes")
                      : t("common.no")
                    : p.finished
                      ? t("live.finished")
                      : t("live.onQuestion", { index: formatNumber(p.currentIndex + 1) }),
              },
              ...(view.teams?.length
                ? [
                    {
                      key: "team",
                      header: t("live.team"),
                      render: (p) => (
                        <select
                          aria-label={t("live.teamFor", { name: p.nickname })}
                          value={p.team || ""}
                          disabled={ended}
                          onChange={(e) => moveTeam(p.id, e.target.value)}
                          className="min-h-11 rounded-control border border-line-strong px-2"
                        >
                          {view.teams.map((tm) => (
                            <option key={tm.team} value={tm.team}>
                              {t("live.teamName", { n: tm.team })}
                            </option>
                          ))}
                        </select>
                      ),
                    },
                  ]
                : []),
              { key: "score", header: t("live.correctOfAnswered"), render: (p) => `${formatNumber(p.correct)} / ${formatNumber(p.answered)}` },
              { key: "accuracy", header: t("live.accuracy"), render: (p) => (p.accuracy === null ? "–" : `${formatNumber(p.accuracy)}%`) },
              ...(session.settings.game ? [{ key: "points", header: t("live.pointsHeader"), render: (p) => formatNumber(p.points) }] : []),
            ]}
            actions={(p) =>
              !ended && (
                <Button variant="ghost" icon={FaUserMinus} className="text-danger-700 hover:bg-danger-50" onClick={() => setRemoving(p)}>
                  {t("live.remove")}
                </Button>
              )
            }
          />
        )}
      </Card>

      <Card>
        <CardHeader title={t("live.resultsPerQuestion")} />
        <CardBody className="space-y-6">
          {perQuestion.map((q) => (
            <section key={q.index} aria-label={t("live.questionOf", { index: q.index + 1, total: session.questionCount })} className="border-b border-line pb-4 last:border-0">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold text-ink">{t("live.questionOf", { index: formatNumber(q.index + 1), total: formatNumber(session.questionCount) })}</h3>
                <span className="text-sm text-ink-muted">
                  {q.answered
                    ? t("live.questionSummary", { answered: formatNumber(q.answered), percent: formatNumber(q.percentCorrect), seconds: formatNumber(Math.round(q.averageMs / 100) / 10) })
                    : t("live.noAnswersYet")}
                </span>
              </div>
              {q.question && (
                <>
                  <p className="mb-3 text-ink" dir={textDirection(q.question.text)}>
                    {q.question.text}
                  </p>
                  {q.answered > 0 && <AnswerBars options={optionsFor(q.question)} distribution={q.distribution} correct={q.question.correctAnswer} />}
                </>
              )}
            </section>
          ))}
        </CardBody>
      </Card>

      <Modal isOpen={Boolean(removing)} onClose={() => setRemoving(null)} title={t("live.removeTitle")} type="warning" onConfirm={remove} confirmText={t("live.remove")}>
        {t("live.removeBody", { name: removing?.nickname })}
      </Modal>
      <Modal isOpen={confirmEnd} onClose={() => setConfirmEnd(false)} title={t("live.endTitle")} type="warning" onConfirm={() => control("end")} confirmText={t("live.end")}>
        {t("live.endBody")}
      </Modal>
    </>
  );
}

export default LiveHost;
