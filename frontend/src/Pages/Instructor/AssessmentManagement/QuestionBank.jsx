import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FaCheck, FaDatabase, FaEdit, FaPlus, FaRedo, FaTrash } from "react-icons/fa";
import {
  addBankQuestionApi,
  approveBankQuestionApi,
  editBankQuestionApi,
  fetchBankQuestionsApi,
  fetchObjectivesApi,
  fetchPoolStatusApi,
  regenerateBankQuestionApi,
  retireBankQuestionApi,
} from "../../../api/assessment.api.js";
import QuestionEditor from "../../../components/assessment/QuestionEditor.jsx";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Modal, PageHeader, Select, SkeletonList } from "../../../components/ui";
import { errorMessage } from "../../../utils/forms.js";
import { LANGUAGE_NAMES, isRtl } from "../../../utils/languages.js";

const TYPE_LABEL = { multiple_choice: "MCQ", true_false: "True/False", short_answer: "Short answer" };
const PAGE_SIZE = 20;

function CorrectAnswer({ question }) {
  const answer = question.correctAnswer;
  if (question.questionType === "true_false") return <span>{answer ? "True" : "False"}</span>;
  if (question.questionType === "short_answer") {
    return (
      <span>
        {answer?.answer}
        {answer?.rubric?.length > 0 && (
          <span className="block text-xs text-ink-muted">Rubric: {answer.rubric.map((r) => [r.concept, ...(r.accept || [])].join(" / ")).join(" · ")}</span>
        )}
      </span>
    );
  }
  return null;
}

function QuestionCard({ question, objectiveIndex, onEdit, onRegenerate, onApprove, onRetire, busy }) {
  const dir = isRtl(question.language) ? "rtl" : "ltr";
  const active = question.status === "active";
  return (
    <li className="p-4 sm:p-6">
      <div className="mb-2 flex flex-wrap gap-1.5">
        <Badge>{LANGUAGE_NAMES[question.language] || question.language}</Badge>
        <Badge tone="primary">O{objectiveIndex + 1}</Badge>
        <Badge>{TYPE_LABEL[question.questionType]}</Badge>
        <Badge>Difficulty {question.difficulty}</Badge>
        {question.origin === "manual" && <Badge>Manual</Badge>}
        {question.approved && <Badge tone="success">Approved</Badge>}
        {question.version > 1 && <Badge>v{question.version}</Badge>}
        <Badge>Served {question.timesServed}×</Badge>
      </div>
      <div dir={dir} lang={question.language}>
        <p className="font-medium text-ink">{question.questionText}</p>
        {question.options && (
          <ol className="mt-2 grid gap-1 sm:grid-cols-2">
            {question.options.map((option, i) => (
              <li
                key={i}
                className={`rounded-control border px-3 py-1.5 text-sm ${
                  option === question.correctAnswer ? "border-success-100 bg-success-50 font-semibold text-success-700" : "border-line text-ink-muted"
                }`}
              >
                {option}
                {option === question.correctAnswer && <span className="sr-only"> (correct)</span>}
              </li>
            ))}
          </ol>
        )}
        {!question.options && (
          <p className="mt-2 text-sm text-success-700">
            <CorrectAnswer question={question} />
          </p>
        )}
      </div>
      {active && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" icon={FaEdit} onClick={() => onEdit(question)} disabled={busy}>
            Edit
          </Button>
          <Button variant="secondary" icon={FaRedo} onClick={() => onRegenerate(question)} loading={busy === `regen-${question.id}`} disabled={Boolean(busy)}>
            Regenerate
          </Button>
          {!question.approved && (
            <Button variant="secondary" icon={FaCheck} onClick={() => onApprove(question)} disabled={Boolean(busy)}>
              Approve
            </Button>
          )}
          <Button variant="ghost" icon={FaTrash} className="text-danger-700" onClick={() => onRetire(question)} disabled={Boolean(busy)}>
            Remove
          </Button>
        </div>
      )}
    </li>
  );
}

function QuestionBank() {
  const { id } = useParams();
  const [filters, setFilters] = useState({ language: "", objective_id: "", difficulty: "", question_type: "", status: "active", search: "" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [objectives, setObjectives] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [editor, setEditor] = useState(null); // { question?: object }
  const [editorError, setEditorError] = useState(null);
  const [retiring, setRetiring] = useState(null);

  useEffect(() => {
    Promise.all([fetchObjectivesApi(id), fetchPoolStatusApi(id)])
      .then(([o, p]) => {
        setObjectives(o.data.data.objectives);
        setLanguages(p.data.data.languages.map((l) => l.language));
      })
      .catch((e) => setLoadError(errorMessage(e, "Could not load this assessment.")));
  }, [id]);

  const load = useCallback(async () => {
    setData(null);
    try {
      const params = Object.fromEntries(Object.entries({ ...filters, page, page_size: PAGE_SIZE }).filter(([, v]) => v !== ""));
      const res = await fetchBankQuestionsApi(id, params);
      setData(res.data.data);
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e, "Could not load the questions."));
    }
  }, [id, filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = (patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const objectiveIndex = (objectiveId) => objectives.findIndex((o) => o.id === objectiveId);

  const run = async (key, fn) => {
    setBusy(key);
    setActionError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const save = async (body) => {
    setBusy("save");
    setEditorError(null);
    try {
      if (editor?.question) await editBankQuestionApi(id, editor.question.id, body);
      else await addBankQuestionApi(id, body);
      setEditor(null);
      await load();
    } catch (e) {
      setEditorError(errorMessage(e, "Could not save the question."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Question bank"
        description="Every question students can receive. Edits create a new version; students who already answered keep the version they saw."
        backTo={`/instructor/assessments/${id}/objectives`}
        backLabel="Objectives & publishing"
        actions={
          <Button icon={FaPlus} onClick={() => { setEditorError(null); setEditor({}); }} disabled={!objectives.length}>
            Add question
          </Button>
        }
      />

      <Card className="mb-6">
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-6">
          <Select label="Language" value={filters.language} onChange={(e) => setFilter({ language: e.target.value })}
            options={[{ value: "", label: "All" }, ...languages.map((l) => ({ value: l, label: LANGUAGE_NAMES[l] || l }))]} />
          <Select label="Objective" value={filters.objective_id} onChange={(e) => setFilter({ objective_id: e.target.value })}
            options={[{ value: "", label: "All" }, ...objectives.map((o, i) => ({ value: o.id, label: `O${i + 1}. ${o.text}` }))]} />
          <Select label="Difficulty" value={filters.difficulty} onChange={(e) => setFilter({ difficulty: e.target.value })}
            options={[{ value: "", label: "All" }, ...[1, 2, 3, 4, 5].map((d) => ({ value: d, label: String(d) }))]} />
          <Select label="Type" value={filters.question_type} onChange={(e) => setFilter({ question_type: e.target.value })}
            options={[{ value: "", label: "All" }, ...Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))]} />
          <Select label="Status" value={filters.status} onChange={(e) => setFilter({ status: e.target.value })}
            options={[{ value: "active", label: "Active" }, { value: "retired", label: "Removed / old versions" }]} />
          <Input label="Search" type="search" value={filters.search} onChange={(e) => setFilter({ search: e.target.value })} />
        </div>
      </Card>

      {actionError && <Alert tone="danger" className="mb-6">{actionError}</Alert>}

      <Card>
        <CardHeader title={data ? `${data.total} question${data.total === 1 ? "" : "s"}` : "Questions"} />
        {loadError ? (
          <div className="p-4 sm:p-6">
            <Alert tone="danger" title="Could not load the questions" action={<Button variant="secondary" onClick={load}>Try again</Button>}>
              {loadError}
            </Alert>
          </div>
        ) : !data ? (
          <SkeletonList rows={5} />
        ) : data.items.length === 0 ? (
          <EmptyState icon={FaDatabase} title="No questions match" description="Change the filters, or wait for publishing to finish." />
        ) : (
          <ul className="divide-y divide-line">
            {data.items.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                objectiveIndex={objectiveIndex(q.objectiveId)}
                busy={busy}
                onEdit={(question) => { setEditorError(null); setEditor({ question }); }}
                onRegenerate={(question) => run(`regen-${question.id}`, () => regenerateBankQuestionApi(id, question.id))}
                onApprove={(question) => run(`approve-${question.id}`, () => approveBankQuestionApi(id, question.id))}
                onRetire={setRetiring}
              />
            ))}
          </ul>
        )}
        {data && data.pages > 1 && (
          <nav className="flex items-center justify-between gap-2 border-t border-line p-4" aria-label="Pages">
            <Button variant="secondary" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
              Previous
            </Button>
            <span className="text-sm text-ink-muted">
              Page {data.page} of {data.pages}
            </span>
            <Button variant="secondary" onClick={() => setPage((p) => p + 1)} disabled={page >= data.pages}>
              Next
            </Button>
          </nav>
        )}
      </Card>

      {editor && (
        <QuestionEditor
          isOpen
          onClose={() => setEditor(null)}
          onSave={save}
          question={editor.question}
          objectives={objectives}
          languages={languages}
          defaults={{ language: filters.language || languages[0], objectiveId: filters.objective_id }}
          saving={busy === "save"}
          error={editorError}
        />
      )}

      <Modal
        isOpen={Boolean(retiring)}
        onClose={() => setRetiring(null)}
        title="Remove this question?"
        type="warning"
        confirmText="Remove"
        onConfirm={() => {
          const q = retiring;
          setRetiring(null);
          run(`retire-${q.id}`, () => retireBankQuestionApi(id, q.id));
        }}
      >
        It will no longer be given to students. Students who already answered it are not affected.
      </Modal>
    </>
  );
}

export default QuestionBank;
