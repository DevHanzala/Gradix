import { useEffect, useMemo, useState } from "react";
import { FaFileUpload, FaLink, FaPlus, FaTrash } from "react-icons/fa";
import useResourceStore from "../../store/resourceStore.js";
import {
  ACCEPTED_FILE_TYPES,
  ASSESSMENT_LIMITS,
  QUESTION_TYPES,
  assessmentFormSchema,
  issuesToErrors,
} from "../../schemas/assessmentSchemas.js";
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
        <legend className="text-sm font-semibold text-ink">Question block {index + 1}</legend>
        {canRemove && (
          <Button variant="ghost" icon={FaTrash} onClick={() => onRemove(index)} disabled={disabled} className="text-danger-700 hover:bg-danger-50">
            Remove
          </Button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Select
          label="Question type"
          value={block.question_type}
          onChange={(e) => onChange(index, "question_type", e.target.value)}
          options={QUESTION_TYPES}
          disabled={disabled}
        />
        <Input label="Number of questions" min={1} max={ASSESSMENT_LIMITS.maxQuestionsPerBlock} {...numberField("question_count")} />
        <Input
          label="Seconds per question"
          min={ASSESSMENT_LIMITS.minDuration}
          max={ASSESSMENT_LIMITS.maxDuration}
          hint={`${ASSESSMENT_LIMITS.minDuration}-${ASSESSMENT_LIMITS.maxDuration}`}
          {...numberField("duration_per_question")}
        />
        {block.question_type === "multiple_choice" && (
          <Input label="Options per question" min={ASSESSMENT_LIMITS.minOptions} max={ASSESSMENT_LIMITS.maxOptions} {...numberField("num_options")} />
        )}
        <Input label="Marks for a correct answer" min={0} step="0.25" {...numberField("positive_marks")} inputMode="decimal" />
        <Input
          label="Deduction for a wrong answer"
          min={0}
          step="0.25"
          hint="0 turns negative marking off"
          {...numberField("negative_marks")}
          inputMode="decimal"
        />
      </div>
    </fieldset>
  );
}

/**
 * Shared create/edit form. `onSubmit(formData)` must return a promise; errors
 * it throws are shown at the top of the form.
 */
function AssessmentForm({ initialValues, submitLabel, onSubmit, onCancel, disabled = false }) {
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
    () => files.filter((f) => f.size > ASSESSMENT_LIMITS.maxFileBytes).map((f) => `${f.name} is larger than 20 MB.`),
    [files]
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
      setSubmitError(error?.response?.data?.message || error?.message || "Could not save the assessment.");
    } finally {
      setSubmitting(false);
    }
  };

  const linkErrors = values.links.map((_, i) => errors[`links.${i}`]);

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {submitError && <Alert tone="danger" title="Not saved">{submitError}</Alert>}

      <Card>
        <CardHeader title="Details" description="Only a title and one source (prompt, resource, file or link) are required." />
        <CardBody className="space-y-4">
          <Input label="Title" value={values.title} onChange={(e) => set("title", e.target.value)} error={errors.title} required disabled={disabled} />
          <Textarea
            label="Prompt"
            hint="Describe the topic, level and anything the questions should focus on. Optional if you add material below."
            rows={5}
            value={values.prompt}
            onChange={(e) => set("prompt", e.target.value)}
            error={errors.prompt}
            disabled={disabled}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Source material" description="Questions are generated from the prompt and everything selected here." />
        <CardBody className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Your resource library</h3>
            {resourcesLoading ? (
              <p className="text-sm text-ink-muted">Loading resources…</p>
            ) : resourcesError ? (
              <Alert tone="danger" action={<Button variant="secondary" onClick={() => fetchAllResources()}>Try again</Button>}>
                Could not load resources.
              </Alert>
            ) : resources.length === 0 ? (
              <p className="text-sm text-ink-muted">No resources yet. Upload files below or from the Resources page.</p>
            ) : (
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-control border border-line p-2">
                {resources.map((r) => (
                  <Checkbox
                    key={r.id}
                    label={r.name}
                    description={r.visibility === "public" ? `Public · ${r.uploader_name || ""}` : "Private"}
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
              Upload new files
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
              PDF, Word, PowerPoint, text or images, up to 20 MB each. Scans are read with OCR.
            </p>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-ink-muted">
                {files.map((f) => (
                  <li key={f.name} className="flex items-center gap-2">
                    <FaFileUpload aria-hidden="true" /> {f.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Reference links</h3>
            <p className="mb-3 text-sm text-ink-subtle">Link titles are passed to the AI; page contents are not downloaded.</p>
            <div className="space-y-3">
              {values.links.map((link, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Input
                    className="flex-1"
                    label={`Link ${i + 1}`}
                    type="url"
                    inputMode="url"
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
                      aria-label={`Remove link ${i + 1}`}
                      icon={FaTrash}
                      onClick={() => set("links", values.links.filter((_, j) => j !== i))}
                      disabled={disabled}
                    >
                      <span className="sr-only">Remove</span>
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button variant="secondary" icon={FaLink} className="mt-3" onClick={() => set("links", [...values.links, ""])} disabled={disabled || values.links.length >= 10}>
              Add link
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Questions and marking" description="Each student gets their own questions following these blocks." />
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
            Add question block
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Exam behaviour" />
        <CardBody className="space-y-1">
          <Checkbox
            label="Adaptive difficulty"
            description="Each student starts at medium difficulty; it goes up after strong answers and down after weak ones. Every student still covers the same objectives."
            checked={Boolean(values.adaptive)}
            onChange={(e) => set("adaptive", e.target.checked)}
            disabled={disabled}
          />
          <Checkbox
            label="Show live score"
            description="Students see whether each answer was correct and their running score during the exam. Off by default."
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
              Cancel
            </Button>
          )}
          <Button type="submit" loading={submitting}>
            {submitting && files.length ? "Processing files…" : submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}

export default AssessmentForm;
