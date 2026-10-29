import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FaImage, FaPlus, FaTrash } from "react-icons/fa";
import { Alert, Button, Input, Modal, Select, Textarea } from "../ui";
import { textDirection } from "../../utils/text.js";
import { LANGUAGE_NAMES, isRtl } from "../../utils/languages.js";
import { uploadQuestionImageApi } from "../../api/assessment.api.js";
import { errorMessage } from "../../utils/forms.js";

const TYPES = ["multiple_choice", "true_false", "short_answer", "fill_blank", "matching"];

/** Upload an image (compressed on the server) and edit its alt text. value = { key, url, alt } | null. */
function ImageField({ assessmentId, value, onChange, label }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { key, url } = (await uploadQuestionImageApi(assessmentId, file)).data.data;
      onChange({ key, url, alt: value?.alt || "" });
    } catch (e) {
      setError(errorMessage(e, t("bank.imageFailed")));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2 rounded-control border border-dashed border-line p-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="btn-secondary cursor-pointer">
          <FaImage aria-hidden="true" />
          <span>{busy ? t("common.loading") : value ? t("bank.replaceImage") : label}</span>
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} disabled={busy} />
        </label>
        {value && (
          <Button variant="ghost" icon={FaTrash} onClick={() => onChange(null)}>
            {t("bank.removeImage")}
          </Button>
        )}
      </div>
      {value?.url && <img src={value.url} alt={value.alt || ""} className="max-h-40 w-auto rounded-control" />}
      {value && (
        <Input label={t("bank.altText")} hint={t("bank.altTextHint")} value={value.alt} maxLength={250} required onChange={(e) => onChange({ ...value, alt: e.target.value })} />
      )}
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
const DIFFICULTIES = [1, 2, 3, 4, 5];

/** "concept: other wording, another" per line <-> rubric items. */
const rubricToText = (rubric = []) => rubric.map((r) => [r.concept, ...(r.accept || [])].join(", ")).join("\n");
const textToRubric = (text) =>
  text
    .split("\n")
    .map((line) => line.split(",").map((p) => p.trim()).filter(Boolean))
    .filter((parts) => parts.length > 0)
    .map(([concept, ...accept]) => ({ concept, accept }));

const initialState = (question, defaults) => {
  const q = question || {};
  const answer = q.correctAnswer;
  return {
    objective_id: q.objectiveId ?? defaults.objectiveId ?? "",
    question_type: q.questionType ?? "multiple_choice",
    language: q.language ?? defaults.language ?? "en",
    difficulty: q.difficulty ?? 3,
    question_text: q.questionText ?? "",
    options: q.options ?? ["", "", "", ""],
    correctIndex: q.options ? Math.max(0, q.options.indexOf(answer)) : 0,
    tfAnswer: answer === false ? "false" : "true",
    modelAnswer: answer && typeof answer === "object" ? answer.answer || "" : "",
    rubricText: answer && typeof answer === "object" ? rubricToText(answer.rubric) : "",
    minMatch: answer && typeof answer === "object" ? answer.min_required_match || 1 : 1,
    blanksText: Array.isArray(answer?.blanks) ? answer.blanks.map((a) => a.join(", ")).join("\n") : "",
    pairs: q.questionType === "matching" && q.options?.left ? q.options.left.map((l, i) => [l, answer?.pairs?.[i] ?? ""]) : [["", ""], ["", ""], ["", ""]],
    partialCredit: answer?.partial_credit !== false,
    image: q.image ?? null,
    optionImages: q.optionImages ?? [],
  };
};

/**
 * Add or edit one bank question. Editing keeps the objective, type and
 * language (they define the bucket) and saves a new version.
 */
function QuestionEditor({ isOpen, onClose, onSave, question, objectives, languages, defaults = {}, saving, error, assessmentId }) {
  const { t } = useTranslation();
  const editing = Boolean(question);
  const [form, setForm] = useState(() => initialState(question, defaults));
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const dir = isRtl(form.language) ? "rtl" : "ltr";

  const submit = (event) => {
    event.preventDefault();
    const body = { difficulty: Number(form.difficulty), question_text: form.question_text };
    if (!editing) Object.assign(body, { objective_id: Number(form.objective_id), question_type: form.question_type, language: form.language });
    const ref = (img) => (img ? { key: img.key, alt: img.alt } : null);
    body.image = ref(form.image);
    if (form.question_type === "multiple_choice") {
      body.options = form.options;
      body.correct_answer = form.options[form.correctIndex];
      body.option_images = form.options.map((_, i) => ref(form.optionImages[i]));
    } else if (form.question_type === "fill_blank") {
      body.correct_answer = { blanks: form.blanksText.split("\n").map((line) => line.split(",").map((a) => a.trim()).filter(Boolean)).filter((a) => a.length) };
    } else if (form.question_type === "matching") {
      body.pairs = form.pairs.filter(([l, r]) => l.trim() && r.trim());
      body.correct_answer = { partial_credit: form.partialCredit };
    } else if (form.question_type === "true_false") {
      body.correct_answer = form.tfAnswer === "true";
    } else {
      const rubric = textToRubric(form.rubricText);
      body.correct_answer = { answer: form.modelAnswer, rubric, min_required_match: Math.min(Number(form.minMatch) || 1, rubric.length || 1) };
    }
    onSave(body);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? t("bank.editTitle") : t("bank.addTitle")}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="question-editor" loading={saving}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <form id="question-editor" onSubmit={submit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {!editing && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label={t("objectives.objective")}
              value={form.objective_id}
              onChange={(e) => set({ objective_id: e.target.value })}
              required
              options={[{ value: "", label: t("common.choose") }, ...objectives.map((o, i) => ({ value: o.id, label: `${i + 1}. ${o.text}` }))]}
            />
            <Select
              label={t("resources.type")}
              value={form.question_type}
              onChange={(e) => set({ question_type: e.target.value })}
              options={TYPES.map((type) => ({ value: type, label: t(`questionTypes.${type}`) }))}
            />
            <Select
              label={t("common.language")}
              value={form.language}
              onChange={(e) => set({ language: e.target.value })}
              options={languages.map((l) => ({ value: l, label: LANGUAGE_NAMES[l] || l }))}
            />
          </div>
        )}
        <Select
          label={t("bank.difficultyLabel")}
          value={form.difficulty}
          onChange={(e) => set({ difficulty: e.target.value })}
          options={DIFFICULTIES.map((d) => ({ value: d, label: t(`bank.levels.${d}`) }))}
        />
        <Textarea
          label={t("bank.question")}
          value={form.question_text}
          dir={dir}
          lang={form.language}
          rows={3}
          required
          onChange={(e) => set({ question_text: e.target.value })}
          hint={form.question_type === "fill_blank" ? t("bank.blankHint") : undefined}
        />
        {assessmentId && <ImageField assessmentId={assessmentId} value={form.image} onChange={(image) => set({ image })} label={t("bank.addImage")} />}

        {form.question_type === "fill_blank" && (
          <Textarea label={t("bank.blankAnswers")} hint={t("bank.blankAnswersHint")} value={form.blanksText} dir={dir} rows={3} onChange={(e) => set({ blanksText: e.target.value })} />
        )}

        {form.question_type === "matching" && (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-semibold text-ink">{t("bank.pairsLegend")}</legend>
            {form.pairs.map(([l, r], i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <Input label={t("bank.pairLeft", { number: i + 1 })} value={l} dir={dir} onChange={(e) => set({ pairs: form.pairs.map((p, j) => (j === i ? [e.target.value, p[1]] : p)) })} />
                <Input label={t("bank.pairRight", { number: i + 1 })} value={r} dir={dir} onChange={(e) => set({ pairs: form.pairs.map((p, j) => (j === i ? [p[0], e.target.value] : p)) })} />
                {form.pairs.length > 3 && (
                  <Button variant="ghost" icon={FaTrash} aria-label={t("bank.removePair", { number: i + 1 })} onClick={() => set({ pairs: form.pairs.filter((_, j) => j !== i) })}>
                    <span className="sr-only">{t("common.remove")}</span>
                  </Button>
                )}
              </div>
            ))}
            {form.pairs.length < 6 && (
              <Button variant="secondary" icon={FaPlus} onClick={() => set({ pairs: [...form.pairs, ["", ""]] })}>
                {t("bank.addPair")}
              </Button>
            )}
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" className="h-5 w-5" checked={form.partialCredit} onChange={(e) => set({ partialCredit: e.target.checked })} />
              {t("bank.partialCredit")}
            </label>
          </fieldset>
        )}

        {form.question_type === "multiple_choice" && (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-semibold text-ink">{t("bank.optionsLegend")}</legend>
            {form.options.map((option, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input
                  type="radio"
                  name="correct"
                  className="h-5 w-5 shrink-0"
                  checked={form.correctIndex === i}
                  onChange={() => set({ correctIndex: i })}
                  aria-label={t("bank.optionCorrect", { number: i + 1 })}
                />
                <Input
                  className="flex-1"
                  aria-label={t("bank.option", { number: i + 1 })}
                  value={option}
                  dir={textDirection(option) === "rtl" ? "rtl" : dir}
                  required
                  onChange={(e) => set({ options: form.options.map((o, j) => (j === i ? e.target.value : o)) })}
                />
                {assessmentId && (
                  <ImageField
                    assessmentId={assessmentId}
                    value={form.optionImages[i] || null}
                    onChange={(img) => set({ optionImages: form.options.map((_, j) => (j === i ? img : form.optionImages[j] || null)) })}
                    label={t("bank.optionImage")}
                  />
                )}
                {form.options.length > 2 && (
                  <Button
                    variant="ghost"
                    icon={FaTrash}
                    aria-label={t("bank.removeOption", { number: i + 1 })}
                    onClick={() =>
                      set({
                        options: form.options.filter((_, j) => j !== i),
                        correctIndex: form.correctIndex === i ? 0 : form.correctIndex > i ? form.correctIndex - 1 : form.correctIndex,
                      })
                    }
                  >
                    <span className="sr-only">{t("common.remove")}</span>
                  </Button>
                )}
              </div>
            ))}
            {form.options.length < 6 && (
              <Button variant="secondary" icon={FaPlus} onClick={() => set({ options: [...form.options, ""] })}>
                {t("bank.addOption")}
              </Button>
            )}
          </fieldset>
        )}

        {form.question_type === "true_false" && (
          <Select
            label={t("preview.correctAnswer")}
            value={form.tfAnswer}
            onChange={(e) => set({ tfAnswer: e.target.value })}
            options={[
              { value: "true", label: t("common.true") },
              { value: "false", label: t("common.false") },
            ]}
          />
        )}

        {form.question_type === "short_answer" && (
          <>
            <Textarea label={t("bank.modelAnswer")} value={form.modelAnswer} dir={dir} rows={2} onChange={(e) => set({ modelAnswer: e.target.value })} />
            <Textarea
              label={t("bank.rubric")}
              hint={t("bank.rubricHint")}
              value={form.rubricText}
              dir={dir}
              rows={3}
              onChange={(e) => set({ rubricText: e.target.value })}
            />
            <Input label={t("bank.conceptsRequired")} type="number" min={1} max={10} value={form.minMatch} onChange={(e) => set({ minMatch: e.target.value })} />
          </>
        )}
      </form>
    </Modal>
  );
}

export default QuestionEditor;
