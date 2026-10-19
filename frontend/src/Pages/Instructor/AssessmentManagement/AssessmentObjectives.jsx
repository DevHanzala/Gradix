import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { FaArrowDown, FaArrowUp, FaListOl, FaPlus, FaRedo, FaSave, FaTrash } from "react-icons/fa";
import { fetchObjectivesApi, regenerateObjectivesApi, saveObjectivesApi } from "../../../api/assessment.api.js";
import AssessmentStatus, { StatusSteps } from "../../../components/assessment/AssessmentStatus.jsx";
import PublishPanel from "../../../components/assessment/PublishPanel.jsx";
import { Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState, Input, Modal, PageHeader, SkeletonList, Textarea } from "../../../components/ui";
import { errorMessage } from "../../../utils/forms.js";
import { textDirection } from "../../../utils/text.js";

const POLL_MS = 3000;
const MAX_OBJECTIVES = 15;
const TYPE_LABEL = { multiple_choice: "MCQ", true_false: "True/False", short_answer: "Short answer" };

let draftKey = 0;
const toDraft = (o) => ({ key: o.id ? `o${o.id}` : `n${++draftKey}`, id: o.id ?? null, text: o.text, description: o.description || "", weight: Number(o.weight) || 1, origin: o.origin || "manual" });

function AssessmentObjectives() {
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
        setLoadError(errorMessage(error, "Could not load the objectives."));
      }
    },
    [id, applyView]
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
      setSaveError(errorMessage(error, "Could not save the objectives."));
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
      setSaveError(errorMessage(error, "Could not start regeneration."));
    }
  };

  const header = (
    <PageHeader
      title="Learning objectives"
      description="What this assessment measures. Every student is tested on the same objectives in the same proportions."
      backTo={`/instructor/assessments/${id}`}
      backLabel="Back to assessment"
    />
  );

  if (loadError && !view) {
    return (
      <>
        {header}
        <Alert tone="danger" title="Could not load the objectives" action={<Button variant="secondary" onClick={() => load({ force: true })}>Try again</Button>}>
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
        <Alert tone="info" title="Reading your material…" className="mb-6">
          Objectives are being extracted from the uploaded material. This page updates by itself.
        </Alert>
      )}
      {view.objectivesState === "failed" && (
        <Alert tone="warning" title="Objectives could not be generated" className="mb-6">
          {view.objectivesError || "Add objectives manually or try again."}
        </Alert>
      )}
      {!editable && (
        <Alert tone="info" title="Locked" className="mb-6">
          This assessment is being published or has been published, so its objectives can no longer change.
        </Alert>
      )}
      {saveError && (
        <Alert tone="danger" className="mb-6">
          {saveError}
        </Alert>
      )}
      {saved && !dirty && (
        <Alert tone="success" className="mb-6">
          Objectives saved. The question plan has been updated.
        </Alert>
      )}

      <Card>
        <CardHeader
          title={`Objectives (${drafts.length}/${MAX_OBJECTIVES})`}
          description="Higher weight means more questions on that objective."
          actions={
            editable && (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" icon={FaRedo} onClick={() => setConfirmRegenerate(true)} disabled={extracting}>
                  Regenerate
                </Button>
                <Button icon={FaSave} onClick={save} loading={saving} disabled={!dirty || invalid}>
                  Save
                </Button>
              </div>
            )
          }
        />
        {drafts.length === 0 ? (
          <EmptyState
            icon={FaListOl}
            title={extracting ? "Waiting for objectives" : "No objectives yet"}
            description={extracting ? "They will appear here in a moment." : "Add the outcomes this assessment should measure."}
            action={editable && !extracting && <Button icon={FaPlus} onClick={add}>Add objective</Button>}
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
                        label="Objective"
                        value={d.text}
                        dir={textDirection(d.text)}
                        onChange={(e) => update(d.key, { text: e.target.value })}
                        disabled={!editable}
                        maxLength={300}
                        error={d.text.trim().length > 0 && d.text.trim().length < 3 ? "Write at least 3 characters." : undefined}
                        required
                      />
                      <Textarea
                        label="What exactly is assessed (optional)"
                        value={d.description}
                        dir={textDirection(d.description)}
                        rows={2}
                        onChange={(e) => update(d.key, { description: e.target.value })}
                        disabled={!editable}
                        maxLength={1000}
                      />
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {d.origin === "ai" ? <Badge tone="primary">AI</Badge> : <Badge>Manual</Badge>}
                        {plan && (
                          <>
                            <Badge tone="success">{plan.count} question{plan.count === 1 ? "" : "s"}</Badge>
                            {Object.entries(plan.types).map(([type, n]) => (
                              <Badge key={type}>
                                {n} × {TYPE_LABEL[type] || type}
                              </Badge>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-end gap-2 lg:w-56 lg:flex-col lg:items-stretch">
                      <Input
                        label="Weight"
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
                          <Button variant="ghost" icon={FaArrowUp} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move objective ${i + 1} up`}>
                            <span className="sr-only">Up</span>
                          </Button>
                          <Button variant="ghost" icon={FaArrowDown} onClick={() => move(i, 1)} disabled={i === drafts.length - 1} aria-label={`Move objective ${i + 1} down`}>
                            <span className="sr-only">Down</span>
                          </Button>
                          <Button variant="ghost" icon={FaTrash} onClick={() => remove(d.key)} aria-label={`Delete objective ${i + 1}`} className="text-danger-700">
                            <span className="sr-only">Delete</span>
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
              Add objective
            </Button>
          </CardBody>
        )}
      </Card>

      {view.blueprint?.slots?.length > 0 && (
        <Card className="mt-6">
          <CardHeader
            title="Question plan"
            description={`${view.blueprint.total} questions per student${view.blueprint.adaptive ? ", difficulty adapts to each student" : ", fixed difficulty mix"}.`}
          />
          <CardBody>
            <ol className="flex flex-wrap gap-2" aria-label="Question order">
              {view.blueprint.slots.map((slot) => {
                const index = drafts.findIndex((d) => d.id === slot.objective_id);
                return (
                  <li key={slot.slot} className="rounded-control border border-line px-2 py-1 text-xs text-ink-muted">
                    Q{slot.slot + 1} · O{index + 1} · {TYPE_LABEL[slot.question_type]}
                    {slot.difficulty ? ` · D${slot.difficulty}` : ""}
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
        title="Regenerate objectives?"
        type="warning"
        onConfirm={regenerate}
        confirmText="Regenerate"
      >
        The current objectives, including your edits, will be replaced by a new AI-generated list.
      </Modal>
    </>
  );
}

export default AssessmentObjectives;
