import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaFileUpload, FaLink, FaPlus, FaTrash } from "react-icons/fa";
import useResourceStore from "../../store/resourceStore.js";
import {
  ACCEPTED_FILE_TYPES,
  ASSESSMENT_LIMITS,
  QUESTION_TYPES,
  assessmentFormSchema,
  issuesToErrors,
} from "../../schemas/assessmentSchemas.js";
import { errorMessage } from "../../utils/forms.js";
import { textDirection } from "../../utils/text.js";
import { Alert, Button, Card, CardBody, CardHeader, Checkbox, Input, Select, Textarea } from "../ui";
import { NEW_BLOCK } from "./assessmentFormValues.js";

const toNumber = (value) => (value === "" || value === null || value === undefined ? NaN : Number(value));

/** Build the multipart body expected by POST/PUT /api/assessments. */
const toFormData = (values, files) => {
  const data = new FormData();
  data.append("title", values.title.trim());
  data.append("prompt", values.prompt.trim());
  data.append("external_links", JSON.stringify(values.links.map((l) => l.trim()).filter(Boolean)));
  data.append("selected_resources", JSON.stringify(values.resourceIds));
  data.append(
    "question_blocks",
    JSON.stringify(
      values.blocks.map((b) => ({
        ...b,
        num_options: b.question_type === "multiple_choice" ? b.num_options : null,
      }))
    )
  );
  data.append("adaptive", String(Boolean(values.adaptive)));
  data.append("show_live_score", String(Boolean(values.showLiveScore)));
  files.forEach((file) => data.append("files", file));
  return data;
};

function QuestionBlockEditor({ index, block, errors, disabled, onChange, onRemove, canRemove }) {
  const { t } = useTranslation();
  const err = (field) => errors[`blocks.${index}.${field}`];
  const numberField = (field) => ({
    type: "number",
    inputMode: "numeric",
    value: Number.isNaN(block[field]) ? "" : block[field],
    onChange: (e) => onChange(index, field, toNumber(e.target.value)),
    error: err(field),
    disabled,
  });

  return (
    <fieldset className="rounded-card border border-line p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <legend className="text-sm font-semibold text-ink">{t("form.blockTitle", { number: index + 1 })}</legend>
        {canRemove && (
          <Button variant="ghost" icon={FaTrash} onClick={() => onRemove(index)} disabled={disabled} className="text-danger-700 hover:bg-danger-50">
            {t("common.remove")}
          </Button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Select
          label={t("form.questionType")}
          value={block.question_type}
          onChange={(e) => onChange(index, "question_type", e.target.value)}
          options={QUESTION_TYPES.map((q) => ({ value: q.value, label: t(q.labelKey) }))}
          disabled={disabled}
        />
        <Input label={t("form.questionCount")} min={1} max={ASSESSMENT_LIMITS.maxQuestionsPerBlock} {...numberField("question_count")} />
        <Input
          label={t("form.secondsPerQuestion")}
          min={ASSESSMENT_LIMITS.minDuration}
          max={ASSESSMENT_LIMITS.maxDuration}
          hint={t("form.secondsHint", { min: ASSESSMENT_LIMITS.minDuration, max: ASSESSMENT_LIMITS.maxDuration })}
          {...numberField("duration_per_question")}
        />
        {block.question_type === "multiple_choice" && (
          <Input label={t("form.optionsPerQuestion")} min={ASSESSMENT_LIMITS.minOptions} max={ASSESSMENT_LIMITS.maxOptions} {...numberField("num_options")} />
        )}
        <Input label={t("form.positiveMarks")} min={0} step="0.25" {...numberField("positive_marks")} inputMode="decimal" />
        <Input label={t("form.negativeMarks")} min={0} step="0.25" hint={t("form.negativeHint")} {...numberField("negative_marks")} inputMode="decimal" />
      </div>
      {block.question_type === "short_answer" && <p className="mt-3 text-sm text-ink-subtle">{t("form.shortAnswerNote")}</p>}
    </fieldset>
  );
}

/**
 * Shared create/edit form. `onSubmit(formData)` must return a promise; errors
 * it throws are shown at the top of the form.
 */
function AssessmentForm({ initialValues, submitLabel, onSubmit, onCancel, disabled = false }) {
  const { t } = useTranslation();
  const { resources, fetchAllResources, loading: resourcesLoading, error: resourcesError } = useResourceStore();
  const [values, setValues] = useState(initialValues);
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAllResources();
  }, [fetchAllResources]);

  const set = (field, value) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const updateBlock = (index, field, value) => {
    setValues((v) => ({ ...v, blocks: v.blocks.map((b, i) => (i === index ? { ...b, [field]: value } : b)) }));
    setErrors((e) => ({ ...e, [`blocks.${index}.${field}`]: undefined }));
  };

  const toggleResource = (id) =>
    set("resourceIds", values.resourceIds.includes(id) ? values.resourceIds.filter((r) => r !== id) : [...values.resourceIds, id]);

  const fileProblems = useMemo(
    () => files.filter((f) => f.size > ASSESSMENT_LIMITS.maxFileBytes).map((f) => t("form.fileTooLarge", { name: f.name, size: 20 })),
    [files, t]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    const parsed = assessmentFormSchema.safeParse({ ...values, fileCount: files.length });
    if (!parsed.success || fileProblems.length) {
      setErrors(parsed.success ? {} : issuesToErrors(parsed.error.issues));
      if (fileProblems.length) setSubmitError(fileProblems.join(" "));
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(toFormData(values, files));
    } catch (error) {
      setSubmitError(errorMessage(error, t("form.saveFailed")));
    } finally {
      setSubmitting(false);
    }
  };

  const linkErrors = values.links.map((_, i) => errors[`links.${i}`]);

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {submitError && (
        <Alert tone="danger" title={t("form.notSaved")}>
          {submitError}
        </Alert>
      )}

      <Card>
        <CardHeader title={t("form.details")} description={t("form.detailsDescription")} />
        <CardBody className="space-y-4">
          <Input
            label={t("form.title")}
            value={values.title}
            dir={textDirection(values.title)}
            onChange={(e) => set("title", e.target.value)}
            error={errors.title}
            required
            disabled={disabled}
          />
          <Textarea
            label={t("form.prompt")}
            hint={t("form.promptHint")}
            rows={5}
            value={values.prompt}
            dir={textDirection(values.prompt)}
            onChange={(e) => set("prompt", e.target.value)}
            error={errors.prompt}
            disabled={disabled}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("form.sourceMaterial")} description={t("form.sourceDescription")} />
        <CardBody className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">{t("form.library")}</h3>
            {resourcesLoading ? (
              <p className="text-sm text-ink-muted">{t("form.loadingResources")}</p>
            ) : resourcesError ? (
              <Alert
                tone="danger"
                action={
                  <Button variant="secondary" onClick={() => fetchAllResources()}>
                    {t("common.tryAgain")}
                  </Button>
                }
              >
                {t("form.resourcesFailed")}
              </Alert>
            ) : resources.length === 0 ? (
              <p className="text-sm text-ink-muted">{t("form.noResources")}</p>
            ) : (
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-control border border-line p-2">
                {resources.map((r) => (
                  <Checkbox
                    key={r.id}
                    label={r.name}
                    description={r.visibility === "public" ? t("form.publicBy", { name: r.uploader_name || "" }) : t("resources.private")}
                    checked={values.resourceIds.includes(r.id)}
                    onChange={() => toggleResource(r.id)}
                    disabled={disabled}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="assessment-files" className="mb-1.5 block text-sm font-semibold text-ink">
              {t("form.uploadFiles")}
            </label>
            <input
              id="assessment-files"
              type="file"
              multiple
              accept={ACCEPTED_FILE_TYPES}
              disabled={disabled}
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              className="block w-full text-sm text-ink-muted file:me-3 file:min-h-11 file:rounded-control file:border-0 file:bg-primary-50 file:px-4 file:font-semibold file:text-primary-700 hover:file:bg-primary-100"
              aria-describedby="assessment-files-hint"
            />
            <p id="assessment-files-hint" className="mt-1 text-sm text-ink-subtle">
              {t("form.filesHint")}
            </p>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-ink-muted">
                {files.map((f) => (
                  <li key={f.name} className="flex items-center gap-2">
                    <FaFileUpload aria-hidden="true" /> <span dir="auto">{f.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">{t("form.links")}</h3>
            <p className="mb-3 text-sm text-ink-subtle">{t("form.linksHint")}</p>
            <div className="space-y-3">
              {values.links.map((link, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Input
                    className="flex-1"
                    label={t("form.linkLabel", { number: i + 1 })}
                    type="url"
                    inputMode="url"
                    dir="ltr"
                    placeholder="https://"
                    value={link}
                    onChange={(e) => set("links", values.links.map((l, j) => (j === i ? e.target.value : l)))}
                    error={linkErrors[i]}
                    disabled={disabled}
                  />
                  {values.links.length > 1 && (
                    <Button
                      variant="ghost"
                      className="mt-7"
                      aria-label={t("form.removeLink", { number: i + 1 })}
                      icon={FaTrash}
                      onClick={() => set("links", values.links.filter((_, j) => j !== i))}
                      disabled={disabled}
                    >
                      <span className="sr-only">{t("common.remove")}</span>
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              variant="secondary"
              icon={FaLink}
              className="mt-3"
              onClick={() => set("links", [...values.links, ""])}
              disabled={disabled || values.links.length >= 10}
            >
              {t("form.addLink")}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("form.questionsAndMarking")} description={t("form.questionsDescription")} />
        <CardBody className="space-y-4">
          {errors.blocks && <Alert tone="danger">{errors.blocks}</Alert>}
          {values.blocks.map((block, i) => (
            <QuestionBlockEditor
              key={i}
              index={i}
              block={block}
              errors={errors}
              disabled={disabled}
              onChange={updateBlock}
              onRemove={(index) => set("blocks", values.blocks.filter((_, j) => j !== index))}
              canRemove={values.blocks.length > 1}
            />
          ))}
          <Button
            variant="secondary"
            icon={FaPlus}
            onClick={() => set("blocks", [...values.blocks, { ...NEW_BLOCK }])}
            disabled={disabled || values.blocks.length >= ASSESSMENT_LIMITS.maxBlocks}
          >
            {t("form.addBlock")}
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("form.examBehaviour")} />
        <CardBody className="space-y-1">
          <Checkbox
            label={t("form.adaptive")}
            description={t("form.adaptiveDescription")}
            checked={Boolean(values.adaptive)}
            onChange={(e) => set("adaptive", e.target.checked)}
            disabled={disabled}
          />
          <Checkbox
            label={t("form.liveScore")}
            description={t("form.liveScoreDescription")}
            checked={Boolean(values.showLiveScore)}
            onChange={(e) => set("showLiveScore", e.target.checked)}
            disabled={disabled}
          />
        </CardBody>
      </Card>

      {!disabled && (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {onCancel && (
            <Button variant="secondary" onClick={onCancel} disabled={submitting}>
              {t("common.cancel")}
            </Button>
          )}
          <Button type="submit" loading={submitting}>
            {submitting && files.length ? t("form.processingFiles") : submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}

export default AssessmentForm;
