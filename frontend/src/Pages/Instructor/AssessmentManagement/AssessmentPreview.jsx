import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaMagic, FaRedo } from "react-icons/fa";
import useAssessmentStore from "../../../store/assessmentStore.js";
import { Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader, PageSpinner } from "../../../components/ui";
import { textDirection } from "../../../utils/text.js";
import { errorMessage } from "../../../utils/forms.js";

/**
 * Instructor preview: generates ONE sample question set exactly as a student
 * would receive it (each real student gets a different set).
 */
function AssessmentPreview() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { getAssessmentById, fetchPreviewQuestions } = useAssessmentStore();
  const [assessment, setAssessment] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [questions, setQuestions] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);

  const answerText = (q) => {
    if (q.question_type === "true_false") return q.correct_answer ? t("common.true") : t("common.false");
    if (q.correct_answer && typeof q.correct_answer === "object") return q.correct_answer.answer || "";
    return String(q.correct_answer ?? "");
  };

  useEffect(() => {
    let active = true;
    getAssessmentById(id)
      .then((data) => active && setAssessment(data))
      .catch((error) => active && setLoadError(errorMessage(error, t("assessments.loadOneFailed"))));
    return () => {
      active = false;
    };
  }, [id, getAssessmentById, t]);

  const generate = async () => {
    setGenerating(true);
    setGenerateError(null);
    try {
      setQuestions(await fetchPreviewQuestions(id));
    } catch (error) {
      setGenerateError(errorMessage(error, t("preview.failed")));
    } finally {
      setGenerating(false);
    }
  };

  if (loadError) {
    return (
      <>
        <PageHeader title={t("preview.title")} backTo="/instructor/assessments" backLabel={t("assessments.all")} />
        <Alert tone="danger">{loadError}</Alert>
      </>
    );
  }
  if (!assessment) return <PageSpinner />;

  return (
    <>
      <PageHeader
        title={t("preview.titleFor", { title: assessment.title })}
        description={t("preview.description")}
        backTo={`/instructor/assessments/${id}`}
        backLabel={t("assessments.backToAssessment")}
        actions={
          <Button icon={questions ? FaRedo : FaMagic} loading={generating} onClick={generate}>
            {questions ? t("preview.again") : t("preview.generate")}
          </Button>
        }
      />

      {generateError && (
        <Alert tone="danger" className="mb-6">
          {generateError}
        </Alert>
      )}

      <Card>
        <CardHeader title={t("preview.sample")} description={t("preview.sampleDescription")} />
        {generating ? (
          <PageSpinner label={t("preview.generating")} />
        ) : !questions ? (
          <EmptyState icon={FaMagic} title={t("preview.none")} description={t("preview.noneDescription")} />
        ) : (
          <CardBody>
            <ol className="space-y-4">
              {questions.map((q, i) => {
                const dir = textDirection(q.question_text);
                const answer = answerText(q);
                return (
                  <li key={`${i}-${q.question_text}`} className="rounded-card border border-line p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink-muted">{t("preview.questionNumber", { number: i + 1 })}</span>
                      <Badge>
                        <span dir="ltr">
                          +{q.positive_marks}
                          {Number(q.negative_marks) > 0 ? ` / −${q.negative_marks}` : ""}
                        </span>{" "}
                        · {t("common.seconds", { count: q.duration_per_question })}
                        {q.difficulty ? ` · ${t("bank.difficulty", { value: q.difficulty })}` : ""}
                      </Badge>
                    </div>
                    <p dir={dir} className="font-medium text-ink">
                      {q.question_text}
                    </p>
                    {Array.isArray(q.options) && (
                      <ul dir={dir} className="mt-3 grid gap-2 sm:grid-cols-2">
                        {q.options.map((opt, oi) => (
                          <li
                            key={opt}
                            className={`flex gap-2 rounded-control border px-3 py-2 text-sm ${opt === answer ? "border-success-600 bg-success-50" : "border-line"}`}
                          >
                            <span className="font-semibold">{String.fromCharCode(65 + oi)}.</span>
                            <span>{opt}</span>
                            {opt === answer && <span className="sr-only">{t("preview.correctMarker")}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                    {!Array.isArray(q.options) && (
                      <p className="mt-3 text-sm text-ink-muted">
                        {t("preview.correctAnswer")} <span className="font-semibold text-ink">{answer}</span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </CardBody>
        )}
      </Card>
    </>
  );
}

export default AssessmentPreview;
