import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaShieldAlt } from "react-icons/fa";
import apiClient from "../../lib/apiClient.js";
import { errorMessage } from "../../utils/forms.js";
import { Alert, Button, Card, CardBody, CardHeader, Checkbox, Input, Select, SkeletonList } from "../ui";

const LEVELS = ["off", "log", "warn", "auto_submit"];
// datetime-local works in the browser's own time; the server stores UTC.
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocalInput = (value) => (value ? new Date(value).toISOString() : null);

/**
 * Exam controls for an assessment: proctoring level, exam window, late join, option
 * shuffling and extra time per enrolled student. Changes apply to attempts started afterwards.
 */
function ExamControlsCard({ assessmentId }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(null);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [settings, extra] = await Promise.all([
        apiClient.get(`/assessments/${assessmentId}/exam-settings`),
        apiClient.get(`/assessments/${assessmentId}/enrollments/extra-time`),
      ]);
      setForm(settings.data.data);
      setStudents(extra.data.data);
      setError(null);
    } catch (e) {
      setError(errorMessage(e, t("examControls.loadFailed")));
    }
  }, [assessmentId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (patch) => {
    setSaved(false);
    setForm((f) => ({ ...f, ...patch }));
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setForm((await apiClient.put(`/assessments/${assessmentId}/exam-settings`, form)).data.data);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err, t("examControls.saveFailed")));
    } finally {
      setBusy(false);
    }
  };

  const setExtra = async (studentId, extraTime) => {
    try {
      await apiClient.put(`/assessments/${assessmentId}/enrollments/${studentId}/extra-time`, { extraTime: Number(extraTime) });
      setStudents((list) => list.map((s) => (s.studentId === studentId ? { ...s, extraTime: Number(extraTime) } : s)));
    } catch (err) {
      setError(errorMessage(err, t("examControls.saveFailed")));
    }
  };

  return (
    <Card>
      <CardHeader title={t("examControls.title")} description={t("examControls.description")} />
      <CardBody>
        {!form ? (
          error ? <Alert tone="danger">{error}</Alert> : <SkeletonList rows={3} />
        ) : (
          <form onSubmit={save} className="space-y-4 text-sm">
            <Select
              label={t("examControls.proctoring")}
              value={form.proctoring}
              onChange={(e) => set({ proctoring: e.target.value })}
              options={LEVELS.map((l) => ({ value: l, label: t(`examControls.levels.${l}`) }))}
            />
            {form.proctoring === "auto_submit" && (
              <Input label={t("examControls.maxViolations")} type="number" min={1} max={20} value={form.maxViolations} onChange={(e) => set({ maxViolations: Number(e.target.value) })} />
            )}
            {form.proctoring !== "off" && <p className="text-ink-muted">{t("examControls.monitoredNote")}</p>}
            <Input label={t("examControls.windowStart")} type="datetime-local" value={toLocalInput(form.windowStart)} onChange={(e) => set({ windowStart: fromLocalInput(e.target.value) })} />
            <Input label={t("examControls.windowEnd")} type="datetime-local" value={toLocalInput(form.windowEnd)} onChange={(e) => set({ windowEnd: fromLocalInput(e.target.value) })} />
            <Input
              label={t("examControls.lateJoin")}
              hint={t("examControls.lateJoinHint")}
              type="number"
              min={0}
              max={1440}
              value={form.lateJoinMinutes ?? ""}
              onChange={(e) => set({ lateJoinMinutes: e.target.value === "" ? null : Number(e.target.value) })}
            />
            <Input label={t("examControls.timeZone")} hint={t("examControls.timeZoneHint")} value={form.timeZone} onChange={(e) => set({ timeZone: e.target.value })} dir="ltr" />
            <Checkbox label={t("examControls.shuffle")} checked={form.shuffleOptions} onChange={(e) => set({ shuffleOptions: e.target.checked })} />
            {error && <Alert tone="danger">{error}</Alert>}
            {saved && <Alert tone="success">{t("examControls.saved")}</Alert>}
            <Button type="submit" icon={FaShieldAlt} loading={busy}>
              {t("common.save")}
            </Button>

            {students.length > 0 && (
              <fieldset className="border-t border-line pt-4">
                <legend className="mb-2 font-semibold text-ink">{t("examControls.extraTime")}</legend>
                <ul className="space-y-2">
                  {students.map((s) => (
                    <li key={s.studentId} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate" dir="auto">
                        {s.name}
                      </span>
                      <select
                        aria-label={t("examControls.extraTimeFor", { name: s.name })}
                        value={String(s.extraTime)}
                        onChange={(e) => setExtra(s.studentId, e.target.value)}
                        className="min-h-11 rounded-control border border-line-strong px-2"
                      >
                        {[1, 1.25, 1.5, 2, 3].map((m) => (
                          <option key={m} value={String(m)}>
                            {m === 1 ? t("examControls.noExtra") : `×${m}`}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              </fieldset>
            )}
          </form>
        )}
      </CardBody>
    </Card>
  );
}

export default ExamControlsCard;
