import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
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

const PAGE_SIZE = 20;

function CorrectAnswer({ question }) {
  const { t } = useTranslation();
  const answer = question.correctAnswer;
  if (question.questionType === "true_false") return <span>{answer ? t("common.true") : t("common.false")}</span>;
  if (question.questionType === "short_answer") {
    return (
      <span>
        {answer?.answer}
        {answer?.rubric?.length > 0 && (
          <span className="block text-xs text-ink-muted">
            {t("bank.rubricShort", { rubric: answer.rubric.map((r) => [r.concept, ...(r.accept || [])].join(" / ")).join(" · ") })}
          </span>
        )}
      </span>
    );
  }
  return null;
}

function QuestionCard({ question, objectiveIndex, onEdit, onRegenerate, onApprove, onRetire, busy }) {
  const { t } = useTranslation();
  const dir = isRtl(question.language) ? "rtl" : "ltr";
  const active = question.status === "active";
  return (
    <li className="p-4 sm:p-6">
      <div className="mb-2 flex flex-wrap gap-1.5">
        <Badge>{LANGUAGE_NAMES[question.language] || question.language}</Badge>
        <Badge tone="primary">{t("bank.objectiveShort", { number: objectiveIndex + 1 })}</Badge>
        <Badge>{t(`questionTypes.${question.questionType}`)}</Badge>
        <Badge>{t("bank.difficulty", { value: question.difficulty })}</Badge>
        {question.origin === "manual" && <Badge>{t("objectives.manual")}</Badge>}
        {question.approved && <Badge tone="success">{t("bank.approved")}</Badge>}
        {question.version > 1 && <Badge>{t("bank.version", { number: question.version })}</Badge>}
        <Badge>{t("bank.served", { count: question.timesServed })}</Badge>
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
                {option === question.correctAnswer && <span className="sr-only"> {t("preview.correctMarker")}</span>}
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
            {t("common.edit")}
          </Button>
          <Button variant="secondary" icon={FaRedo} onClick={() => onRegenerate(question)} loading={busy === `regen-${question.id}`} disabled={Boolean(busy)}>
            {t("objectives.regenerate")}
          </Button>
          {!question.approved && (
            <Button variant="secondary" icon={FaCheck} onClick={() => onApprove(question)} disabled={Boolean(busy)}>
              {t("bank.approve")}
            </Button>
          )}
          <Button variant="ghost" icon={FaTrash} className="text-danger-700" onClick={() => onRetire(question)} disabled={Boolean(busy)}>
            {t("common.remove")}
          </Button>
        </div>
      )}
    </li>
  );
}

function QuestionBank() {
  const { t } = useTranslation();
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
      .catch((e) => setLoadError(errorMessage(e, t("assessments.loadOneFailed"))));
  }, [id, t]);

  const load = useCallback(async () => {
    setData(null);
    try {
      const params = Object.fromEntries(Object.entries({ ...filters, page, page_size: PAGE_SIZE }).filter(([, v]) => v !== ""));
      const res = await fetchBankQuestionsApi(id, params);
      setData(res.data.data);
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e, t("bank.loadFailed")));
    }
  }, [id, filters, page, t]);

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
      setEditorError(errorMessage(e, t("bank.saveFailed")));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title={t("bank.title")}
        description={t("bank.description")}
        backTo={`/instructor/assessments/${id}/objectives`}
        backLabel={t("detail.objectivesAndPublishing")}
        actions={
          <Button icon={FaPlus} onClick={() => { setEditorError(null); setEditor({}); }} disabled={!objectives.length}>
            {t("bank.addQuestion")}
          </Button>
        }
      />

      <Card className="mb-6">
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-6">
          <Select
            label={t("common.language")}
            value={filters.language}
            onChange={(e) => setFilter({ language: e.target.value })}
            options={[{ value: "", label: t("common.all") }, ...languages.map((l) => ({ value: l, label: LANGUAGE_NAMES[l] || l }))]}
          />
          <Select
            label={t("objectives.objective")}
            value={filters.objective_id}
            onChange={(e) => setFilter({ objective_id: e.target.value })}
            options={[
              { value: "", label: t("common.all") },
              ...objectives.map((o, i) => ({ value: o.id, label: `${t("bank.objectiveShort", { number: i + 1 })}. ${o.text}` })),
            ]}
          />
          <Select
            label={t("bank.difficultyLabel")}
            value={filters.difficulty}
            onChange={(e) => setFilter({ difficulty: e.target.value })}
            options={[{ value: "", label: t("common.all") }, ...[1, 2, 3, 4, 5].map((d) => ({ value: d, label: t(`bank.levels.${d}`) }))]}
          />
          <Select
            label={t("resources.type")}
            value={filters.question_type}
            onChange={(e) => setFilter({ question_type: e.target.value })}
            options={[
              { value: "", label: t("common.all") },
              ...["multiple_choice", "true_false", "short_answer"].map((value) => ({ value, label: t(`questionTypes.${value}`) })),
            ]}
          />
          <Select
            label={t("users.status")}
            value={filters.status}
            onChange={(e) => setFilter({ status: e.target.value })}
            options={[
              { value: "active", label: t("bank.active") },
              { value: "retired", label: t("bank.retired") },
            ]}
          />
          <Input label={t("common.search")} type="search" value={filters.search} onChange={(e) => setFilter({ search: e.target.value })} />
        </div>
      </Card>

      {actionError && <Alert tone="danger" className="mb-6">{actionError}</Alert>}

      <Card>
        <CardHeader title={data ? t("studentDashboard.questionCount", { count: data.total }) : t("assessments.questions")} />
        {loadError ? (
          <div className="p-4 sm:p-6">
            <Alert
              tone="danger"
              title={t("bank.loadFailedTitle")}
              action={
                <Button variant="secondary" onClick={load}>
                  {t("common.tryAgain")}
                </Button>
              }
            >
              {loadError}
            </Alert>
          </div>
        ) : !data ? (
          <SkeletonList rows={5} />
        ) : data.items.length === 0 ? (
          <EmptyState icon={FaDatabase} title={t("bank.noMatch")} description={t("bank.noMatchBody")} />
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
          <nav className="flex items-center justify-between gap-2 border-t border-line p-4" aria-label={t("common.pages")}>
            <Button variant="secondary" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
              {t("common.previous")}
            </Button>
            <span className="text-sm text-ink-muted">{t("common.pageOf", { page: data.page, pages: data.pages })}</span>
            <Button variant="secondary" onClick={() => setPage((p) => p + 1)} disabled={page >= data.pages}>
              {t("common.next")}
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
        title={t("bank.removeTitle")}
        type="warning"
        confirmText={t("common.remove")}
        onConfirm={() => {
          const q = retiring;
          setRetiring(null);
          run(`retire-${q.id}`, () => retireBankQuestionApi(id, q.id));
        }}
      >
        {t("bank.removeBody")}
      </Modal>
    </>
  );
}

export default QuestionBank;
