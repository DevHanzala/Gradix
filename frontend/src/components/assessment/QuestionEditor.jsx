import { useState } from "react";
import { FaPlus, FaTrash } from "react-icons/fa";
import { Alert, Button, Input, Modal, Select, Textarea } from "../ui";
import { textDirection } from "../../utils/text.js";
import { LANGUAGE_NAMES, isRtl } from "../../utils/languages.js";

const TYPES = [
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "true_false", label: "True / False" },
  { value: "short_answer", label: "Short answer" },
];
const DIFFICULTIES = [1, 2, 3, 4, 5].map((d) => ({ value: d, label: `${d} – ${["Recall", "Understand", "Apply", "Analyse", "Evaluate"][d - 1]}` }));

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
  };
};

/**
 * Add or edit one bank question. Editing keeps the objective, type and
 * language (they define the bucket) and saves a new version.
 */
function QuestionEditor({ isOpen, onClose, onSave, question, objectives, languages, defaults = {}, saving, error }) {
  const editing = Boolean(question);
  const [form, setForm] = useState(() => initialState(question, defaults));
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const dir = isRtl(form.language) ? "rtl" : "ltr";

  const submit = (event) => {
    event.preventDefault();
    const body = { difficulty: Number(form.difficulty), question_text: form.question_text };
    if (!editing) Object.assign(body, { objective_id: Number(form.objective_id), question_type: form.question_type, language: form.language });
    if (form.question_type === "multiple_choice") {
      body.options = form.options;
      body.correct_answer = form.options[form.correctIndex];
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
      title={editing ? "Edit question (saves a new version)" : "Add a question"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="question-editor" loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <form id="question-editor" onSubmit={submit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {!editing && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label="Objective"
              value={form.objective_id}
              onChange={(e) => set({ objective_id: e.target.value })}
              required
              options={[{ value: "", label: "Choose…" }, ...objectives.map((o, i) => ({ value: o.id, label: `${i + 1}. ${o.text}` }))]}
            />
            <Select label="Type" value={form.question_type} onChange={(e) => set({ question_type: e.target.value })} options={TYPES} />
            <Select
              label="Language"
              value={form.language}
              onChange={(e) => set({ language: e.target.value })}
              options={languages.map((l) => ({ value: l, label: LANGUAGE_NAMES[l] || l }))}
            />
          </div>
        )}
        <Select label="Difficulty" value={form.difficulty} onChange={(e) => set({ difficulty: e.target.value })} options={DIFFICULTIES} />
        <Textarea label="Question" value={form.question_text} dir={dir} rows={3} required onChange={(e) => set({ question_text: e.target.value })} />

        {form.question_type === "multiple_choice" && (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-semibold text-ink">Options (select the correct one)</legend>
            {form.options.map((option, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct"
                  className="h-5 w-5 shrink-0"
                  checked={form.correctIndex === i}
                  onChange={() => set({ correctIndex: i })}
                  aria-label={`Option ${i + 1} is correct`}
                />
                <Input
                  className="flex-1"
                  aria-label={`Option ${i + 1}`}
                  value={option}
                  dir={textDirection(option) === "rtl" ? "rtl" : dir}
                  required
                  onChange={(e) => set({ options: form.options.map((o, j) => (j === i ? e.target.value : o)) })}
                />
                {form.options.length > 2 && (
                  <Button
                    variant="ghost"
                    icon={FaTrash}
                    aria-label={`Remove option ${i + 1}`}
                    onClick={() =>
                      set({
                        options: form.options.filter((_, j) => j !== i),
                        correctIndex: form.correctIndex === i ? 0 : form.correctIndex > i ? form.correctIndex - 1 : form.correctIndex,
                      })
                    }
                  >
                    <span className="sr-only">Remove</span>
                  </Button>
                )}
              </div>
            ))}
            {form.options.length < 6 && (
              <Button variant="secondary" icon={FaPlus} onClick={() => set({ options: [...form.options, ""] })}>
                Add option
              </Button>
            )}
          </fieldset>
        )}

        {form.question_type === "true_false" && (
          <Select
            label="Correct answer"
            value={form.tfAnswer}
            onChange={(e) => set({ tfAnswer: e.target.value })}
            options={[
              { value: "true", label: "True" },
              { value: "false", label: "False" },
            ]}
          />
        )}

        {form.question_type === "short_answer" && (
          <>
            <Textarea label="Model answer" value={form.modelAnswer} dir={dir} rows={2} onChange={(e) => set({ modelAnswer: e.target.value })} />
            <Textarea
              label="Rubric: one concept per line"
              hint="Write the concept first, then other accepted wordings, separated by commas."
              value={form.rubricText}
              dir={dir}
              rows={3}
              onChange={(e) => set({ rubricText: e.target.value })}
            />
            <Input label="Concepts required" type="number" min={1} max={10} value={form.minMatch} onChange={(e) => set({ minMatch: e.target.value })} />
          </>
        )}
      </form>
    </Modal>
  );
}

export default QuestionEditor;
