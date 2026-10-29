import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaBroadcastTower, FaPlay } from "react-icons/fa";
import { createLiveSessionApi, fetchLiveSessionsApi } from "../../../api/live.api.js";
import { fetchInstructorAssessments } from "../../../api/assessment.api.js";
import { errorMessage } from "../../../utils/forms.js";
import { formatDateTime, formatNumber } from "../../../utils/format.js";
import { LANGUAGE_NAMES } from "../../../utils/languages.js";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Checkbox, EmptyState, Input, PageHeader, ResponsiveTable, Select, SkeletonList, Textarea } from "../../../components/ui";

const STATUS_TONES = { lobby: "warning", running: "primary", paused: "warning", ended: "neutral" };

const EMPTY_FORM = {
  source: "bank",
  assessmentId: "",
  topic: "",
  title: "",
  language: "en",
  count: 10,
  secondsPerQuestion: 30,
  pacing: "teacher",
  questionMode: "same",
  timeLimitMinutes: 15,
  settings: { game: false, showLeaderboard: true, sounds: true, anonymousNames: false },
};

/** The instructor's live sessions, and a form to start a new one. */
function LiveSessions() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [list, mine] = await Promise.all([fetchLiveSessionsApi(), fetchInstructorAssessments()]);
      setSessions(list.data.data);
      const published = (mine.data.data || []).filter((a) => a.status === "published");
      setAssessments(published);
      setLoadError(null);
      setForm((f) => (f.assessmentId || !published.length ? f : { ...f, assessmentId: String(published[0].id), language: published[0].languages?.[0] || "en" }));
    } catch (e) {
      setLoadError(errorMessage(e, t("live.loadFailed")));
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setSetting = (key, value) => setForm((f) => ({ ...f, settings: { ...f.settings, [key]: value } }));
  const chosenAssessment = assessments.find((a) => String(a.id) === String(form.assessmentId));
  const languageOptions = (form.source === "bank" ? chosenAssessment?.languages || [] : Object.keys(LANGUAGE_NAMES)).map((code) => ({
    value: code,
    label: LANGUAGE_NAMES[code] || code,
  }));

  const create = async (e) => {
    e.preventDefault();
    setCreating(true);
    setFormError(null);
    try {
      const body = {
        ...form,
        assessmentId: form.source === "bank" ? Number(form.assessmentId) : undefined,
        questionMode: form.source === "ai" ? "same" : form.questionMode,
      };
      const res = await createLiveSessionApi(body);
      navigate(`/instructor/live/${res.data.data.session.id}`);
    } catch (err) {
      setFormError(errorMessage(err, t("live.createFailed")));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <PageHeader title={t("live.title")} description={t("live.description")} />

      <Card className="mb-6">
        <CardHeader title={t("live.newSession")} description={t("live.newSessionHint")} />
        <CardBody>
          <form onSubmit={create} className="grid gap-4 md:grid-cols-2" noValidate>
            <fieldset className="md:col-span-2">
              <legend className="mb-2 text-sm font-semibold text-ink">{t("live.questionsFrom")}</legend>
              <div className="flex flex-wrap gap-2">
                {["bank", "ai"].map((source) => (
                  <label key={source} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-control border px-3 ${form.source === source ? "border-primary-600 bg-primary-50" : "border-line"}`}>
                    <input type="radio" name="source" value={source} checked={form.source === source} onChange={() => set("source", source)} />
                    {source === "bank" ? t("live.fromBank") : t("live.fromAi")}
                  </label>
                ))}
              </div>
            </fieldset>

            {form.source === "bank" ? (
              assessments.length ? (
                <Select
                  label={t("live.assessment")}
                  value={form.assessmentId}
                  onChange={(e) => {
                    const a = assessments.find((x) => String(x.id) === e.target.value);
                    setForm((f) => ({ ...f, assessmentId: e.target.value, language: a?.languages?.[0] || f.language }));
                  }}
                  options={assessments.map((a) => ({ value: String(a.id), label: a.title }))}
                />
              ) : (
                <Alert tone="info" className="md:col-span-2">
                  {t("live.noPublishedAssessments")}
                </Alert>
              )
            ) : (
              <Textarea label={t("live.topic")} hint={t("live.topicHint")} value={form.topic} onChange={(e) => set("topic", e.target.value)} rows={2} maxLength={500} />
            )}

            <Input label={t("live.sessionTitle")} hint={t("common.optional")} value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={200} />
            <Select label={t("common.language")} value={form.language} onChange={(e) => set("language", e.target.value)} options={languageOptions} />
            <Input label={t("live.questionCount")} type="number" min={1} max={50} value={form.count} onChange={(e) => set("count", e.target.value)} />
            <Input label={t("live.secondsPerQuestion")} type="number" min={5} max={600} value={form.secondsPerQuestion} onChange={(e) => set("secondsPerQuestion", e.target.value)} />

            <Select
              label={t("live.pacing")}
              value={form.pacing}
              onChange={(e) => set("pacing", e.target.value)}
              options={[
                { value: "teacher", label: t("live.teacherPaced") },
                { value: "student", label: t("live.studentPaced") },
              ]}
            />
            {form.pacing === "student" && (
              <Input label={t("live.timeLimit")} type="number" min={1} max={240} value={form.timeLimitMinutes} onChange={(e) => set("timeLimitMinutes", e.target.value)} />
            )}
            {form.source === "bank" && (
              <Select
                label={t("live.questionMode")}
                value={form.questionMode}
                onChange={(e) => set("questionMode", e.target.value)}
                options={[
                  { value: "same", label: t("live.sameForAll") },
                  { value: "unique", label: t("live.uniquePerStudent") },
                ]}
              />
            )}

            <fieldset className="md:col-span-2">
              <legend className="mb-1 text-sm font-semibold text-ink">{t("live.settings")}</legend>
              <div className="grid gap-1 sm:grid-cols-2">
                <Checkbox label={t("live.gameMode")} description={t("live.gameModeHint")} checked={form.settings.game} onChange={(e) => setSetting("game", e.target.checked)} />
                <Checkbox label={t("live.showLeaderboard")} checked={form.settings.showLeaderboard} onChange={(e) => setSetting("showLeaderboard", e.target.checked)} disabled={!form.settings.game} />
                <Checkbox label={t("live.sounds")} checked={form.settings.sounds} onChange={(e) => setSetting("sounds", e.target.checked)} />
                <Checkbox label={t("live.anonymousNamesOption")} description={t("live.anonymousNamesHint")} checked={form.settings.anonymousNames} onChange={(e) => setSetting("anonymousNames", e.target.checked)} />
              </div>
            </fieldset>

            {formError && (
              <Alert tone="danger" className="md:col-span-2">
                {formError}
              </Alert>
            )}
            <div className="md:col-span-2">
              <Button type="submit" icon={FaPlay} loading={creating} disabled={form.source === "bank" ? !form.assessmentId : form.topic.trim().length < 3}>
                {t("live.createSession")}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("live.pastSessions")} />
        {loadError ? (
          <CardBody>
            <Alert tone="danger" action={<Button variant="secondary" onClick={load}>{t("common.tryAgain")}</Button>}>
              {loadError}
            </Alert>
          </CardBody>
        ) : !sessions ? (
          <SkeletonList rows={3} />
        ) : sessions.length === 0 ? (
          <EmptyState icon={FaBroadcastTower} title={t("live.noSessions")} description={t("live.noSessionsHint")} />
        ) : (
          <ResponsiveTable
            caption={t("live.pastSessions")}
            rows={sessions}
            columns={[
              { key: "title", header: t("live.sessionTitle"), render: (s) => <span className="font-semibold">{s.title}</span> },
              { key: "code", header: t("live.code"), render: (s) => <span dir="ltr" className="tabular-nums">{s.code}</span> },
              { key: "status", header: t("live.statusLabel"), render: (s) => <Badge tone={STATUS_TONES[s.status]}>{t(`live.status.${s.status}`)}</Badge> },
              { key: "participants", header: t("live.participants"), render: (s) => formatNumber(s.participants) },
              { key: "correct", header: t("live.percentCorrect"), render: (s) => (s.percent_correct === null ? "–" : `${formatNumber(s.percent_correct)}%`) },
              { key: "created_at", header: t("live.createdAt"), render: (s) => formatDateTime(s.created_at) },
            ]}
            actions={(s) => (
              <Button variant="secondary" to={`/instructor/live/${s.id}`}>
                {s.status === "ended" ? t("live.viewResults") : t("live.open")}
              </Button>
            )}
          />
        )}
      </Card>
    </>
  );
}

export default LiveSessions;
