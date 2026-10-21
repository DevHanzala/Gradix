import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaArrowDown, FaArrowUp, FaListOl, FaPlus, FaRedo, FaSave, FaTrash } from "react-icons/fa";
import { fetchObjectivesApi, regenerateObjectivesApi, saveObjectivesApi } from "../../../api/assessment.api.js";
import AssessmentStatus, { StatusSteps } from "../../../components/assessment/AssessmentStatus.jsx";
import PublishPanel from "../../../components/assessment/PublishPanel.jsx";
import { Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState, Input, Modal, PageHeader, SkeletonList, Textarea } from "../../../components/ui";
import { errorMessage } from "../../../utils/forms.js";
import { textDirection } from "../../../utils/text.js";

const POLL_MS = 3000;
const MAX_OBJECTIVES = 15;

let draftKey = 0;
const toDraft = (o) => ({ key: o.id ? `o${o.id}` : `n${++draftKey}`, id: o.id ?? null, text: o.text, description: o.description || "", weight: Number(o.weight) || 1, origin: o.origin || "manual" });

function AssessmentObjectives() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [view, setView] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  const applyView = useCallback((data, { force = false } = {}) => {
    setView(data);
    // Never overwrite unsaved edits with a background refresh.
    if (force || !dirtyRef.current) {
      setDrafts(data.objectives.map(toDraft));
      setDirty(false);
    }
  }, []);

  const load = useCallback(
    async (options) => {
      try {
        const res = await fetchObjectivesApi(id);
        applyView(res.data.data, options);
        setLoadError(null);
      } catch (error) {
        setLoadError(errorMessage(error, t("objectives.loadFailed")));
      }
    },
    [id, applyView, t]
  );

  useEffect(() => {
    load({ force: true });
  }, [load]);

  // Poll while the background extraction runs.
  const extracting = view?.objectivesState === "extracting";
  useEffect(() => {
    if (!extracting) return undefined;
    const timer = setInterval(() => load(), POLL_MS);
    return () => clearInterval(timer);
  }, [extracting, load]);

  const update = (key, patch) => {
    setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));
    setDirty(true);
    setSaved(false);
  };
  const move = (index, delta) => {
    setDrafts((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });
    setDirty(true);
    setSaved(false);
  };
  const remove = (key) => {
    setDrafts((list) => list.filter((d) => d.key !== key));
    setDirty(true);
    setSaved(false);
  };
  const add = () => {
    setDrafts((list) => [...list, toDraft({ text: "", weight: 1 })]);
    setDirty(true);
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await saveObjectivesApi(
        id,
        drafts.map(({ id: objectiveId, text, description, weight }) => ({ id: objectiveId, text, description, weight }))
      );
      applyView(res.data.data, { force: true });
      setSaved(true);
    } catch (error) {
      setSaveError(errorMessage(error, t("objectives.saveFailed")));
    } finally {
      setSaving(false);
    }
  };

  const regenerate = async () => {
    setConfirmRegenerate(false);
    setSaveError(null);
    try {
      const res = await regenerateObjectivesApi(id);
      applyView(res.data.data, { force: true });
    } catch (error) {
      setSaveError(errorMessage(error, t("objectives.regenerateFailed")));
    }
  };

  const header = (
    <PageHeader
      title={t("objectives.title")}
      description={t("objectives.description")}
      backTo={`/instructor/assessments/${id}`}
      backLabel={t("assessments.backToAssessment")}
    />
  );

  if (loadError && !view) {
    return (
      <>
        {header}
        <Alert
          tone="danger"
          title={t("objectives.loadFailedTitle")}
          action={
            <Button variant="secondary" onClick={() => load({ force: true })}>
              {t("common.tryAgain")}
            </Button>
          }
        >
          {loadError}
        </Alert>
      </>
    );
  }
  if (!view) {
    return (
      <>
        {header}
        <Card>
          <SkeletonList rows={5} />
        </Card>
      </>
    );
  }

  const editable = view.editable;
  const blueprintByObjective = new Map((view.blueprint?.objectives || []).map((b) => [b.objective_id, b]));
  const invalid = drafts.some((d) => d.text.trim().length < 3) || drafts.length === 0;

  return (
    <>
      {header}

      <Card className="mb-6">
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <StatusSteps assessment={view} />
          <AssessmentStatus assessment={view} />
        </CardBody>
      </Card>

      {extracting && (
        <Alert tone="info" title={t("objectives.extractingTitle")} className="mb-6">
          {t("objectives.extractingBody")}
        </Alert>
      )}
      {view.objectivesState === "failed" && (
        <Alert tone="warning" title={t("objectives.failedTitle")} className="mb-6">
          {t("objectives.failedBody")}
        </Alert>
      )}
      {!editable && (
        <Alert tone="info" title={t("objectives.lockedTitle")} className="mb-6">
          {t("objectives.lockedBody")}
        </Alert>
      )}
      {saveError && (
        <Alert tone="danger" className="mb-6">
          {saveError}
        </Alert>
      )}
      {saved && !dirty && (
        <Alert tone="success" className="mb-6">
          {t("objectives.saved")}
        </Alert>
      )}

      <Card>
        <CardHeader
          title={t("objectives.count", { count: drafts.length, max: MAX_OBJECTIVES })}
          description={t("objectives.weightHint")}
          actions={
            editable && (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" icon={FaRedo} onClick={() => setConfirmRegenerate(true)} disabled={extracting}>
                  {t("objectives.regenerate")}
                </Button>
                <Button icon={FaSave} onClick={save} loading={saving} disabled={!dirty || invalid}>
                  {t("common.save")}
                </Button>
              </div>
            )
          }
        />
        {drafts.length === 0 ? (
          <EmptyState
            icon={FaListOl}
            title={extracting ? t("objectives.waiting") : t("objectives.none")}
            description={extracting ? t("objectives.waitingBody") : t("objectives.noneBody")}
            action={
              editable &&
              !extracting && (
                <Button icon={FaPlus} onClick={add}>
                  {t("objectives.add")}
                </Button>
              )
            }
          />
        ) : (
          <ol className="divide-y divide-line">
            {drafts.map((d, i) => {
              const plan = d.id ? blueprintByObjective.get(d.id) : null;
              return (
                <li key={d.key} className="p-4 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 font-semibold text-primary-700">{i + 1}</span>
                    <div className="min-w-0 flex-1 space-y-3">
                      <Input
                        label={t("objectives.objective")}
                        value={d.text}
                        dir={textDirection(d.text)}
                        onChange={(e) => update(d.key, { text: e.target.value })}
                        disabled={!editable}
                        maxLength={300}
                        error={d.text.trim().length > 0 && d.text.trim().length < 3 ? t("objectives.min3") : undefined}
                        required
                      />
                      <Textarea
                        label={t("objectives.whatAssessed")}
                        value={d.description}
                        dir={textDirection(d.description)}
                        rows={2}
                        onChange={(e) => update(d.key, { description: e.target.value })}
                        disabled={!editable}
                        maxLength={1000}
                      />
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {d.origin === "ai" ? <Badge tone="primary">{t("objectives.ai")}</Badge> : <Badge>{t("objectives.manual")}</Badge>}
                        {plan && (
                          <>
                            <Badge tone="success">{t("studentDashboard.questionCount", { count: plan.count })}</Badge>
                            {Object.entries(plan.types).map(([type, n]) => (
                              <Badge key={type}>
                                {n} × {t(`questionTypes.${type}`)}
                              </Badge>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-end gap-2 lg:w-56 lg:flex-col lg:items-stretch">
                      <Input
                        label={t("objectives.weight")}
                        type="number"
                        min={0.5}
                        max={10}
                        step={0.5}
                        value={d.weight}
                        onChange={(e) => update(d.key, { weight: e.target.value === "" ? "" : Number(e.target.value) })}
                        disabled={!editable}
                        className="w-28 lg:w-full"
                      />
                      {editable && (
                        <div className="flex gap-2">
                          <Button variant="ghost" icon={FaArrowUp} onClick={() => move(i, -1)} disabled={i === 0} aria-label={t("objectives.moveUp", { number: i + 1 })}>
                            <span className="sr-only">{t("objectives.up")}</span>
                          </Button>
                          <Button variant="ghost" icon={FaArrowDown} onClick={() => move(i, 1)} disabled={i === drafts.length - 1} aria-label={t("objectives.moveDown", { number: i + 1 })}>
                            <span className="sr-only">{t("objectives.down")}</span>
                          </Button>
                          <Button variant="ghost" icon={FaTrash} onClick={() => remove(d.key)} aria-label={t("objectives.deleteOne", { number: i + 1 })} className="text-danger-700">
                            <span className="sr-only">{t("common.delete")}</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {editable && drafts.length > 0 && (
          <CardBody className="border-t border-line">
            <Button variant="secondary" icon={FaPlus} onClick={add} disabled={drafts.length >= MAX_OBJECTIVES}>
              {t("objectives.add")}
            </Button>
          </CardBody>
        )}
      </Card>

      {view.blueprint?.slots?.length > 0 && (
        <Card className="mt-6">
          <CardHeader
            title={t("objectives.plan")}
            description={view.blueprint.adaptive ? t("objectives.planAdaptive", { count: view.blueprint.total }) : t("objectives.planFixed", { count: view.blueprint.total })}
          />
          <CardBody>
            <ol className="flex flex-wrap gap-2" aria-label={t("objectives.order")}>
              {view.blueprint.slots.map((slot) => {
                const index = drafts.findIndex((d) => d.id === slot.objective_id);
                return (
                  <li key={slot.slot} className="rounded-control border border-line px-2 py-1 text-xs text-ink-muted">
                    {t("objectives.slot", { q: slot.slot + 1, o: index + 1, type: t(`questionTypes.${slot.question_type}`) })}
                    {slot.difficulty ? ` · ${t("bank.difficulty", { value: slot.difficulty })}` : ""}
                  </li>
                );
              })}
            </ol>
          </CardBody>
        </Card>
      )}

      {view.status !== "draft" && (
        <PublishPanel
          assessmentId={id}
          status={view.status}
          canPublish={view.status === "objectives_ready" && !dirty && drafts.length > 0}
          onStatusChange={() => load({ force: !dirty })}
        />
      )}

      <Modal
        isOpen={confirmRegenerate}
        onClose={() => setConfirmRegenerate(false)}
        title={t("objectives.regenerateTitle")}
        type="warning"
        onConfirm={regenerate}
        confirmText={t("objectives.regenerate")}
      >
        {t("objectives.regenerateBody")}
      </Modal>
    </>
  );
}

export default AssessmentObjectives;
