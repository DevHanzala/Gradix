import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FaMagic, FaRedo } from "react-icons/fa";
import useAssessmentStore from "../../../store/assessmentStore.js";
import { Alert, Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader, PageSpinner } from "../../../components/ui";
import { textDirection } from "../../../utils/text.js";
import { errorMessage } from "../../../utils/forms.js";

const answerText = (q) => {
  if (q.question_type === "true_false") return q.correct_answer ? "True" : "False";
  if (q.correct_answer && typeof q.correct_answer === "object") return q.correct_answer.answer || "";
  return String(q.correct_answer ?? "");
};

/**
 * Instructor preview: generates ONE sample question set exactly as a student
 * would receive it (each real student gets a different set).
 */
function AssessmentPreview() {
  const { id } = useParams();
  const { getAssessmentById, fetchPreviewQuestions } = useAssessmentStore();
  const [assessment, setAssessment] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [questions, setQuestions] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);

  useEffect(() => {
    let active = true;
    getAssessmentById(id)
      .then((data) => active && setAssessment(data))
      .catch((error) => active && setLoadError(errorMessage(error, "Could not load this assessment.")));
    return () => {
      active = false;
    };
  }, [id, getAssessmentById]);

  const generate = async () => {
    setGenerating(true);
    setGenerateError(null);
    try {
      setQuestions(await fetchPreviewQuestions(id));
    } catch (error) {
      setGenerateError(errorMessage(error, "Could not generate sample questions."));
    } finally {
      setGenerating(false);
    }
  };

  if (loadError) {
    return (
      <>
        <PageHeader title="Preview" backTo="/instructor/assessments" backLabel="All assessments" />
        <Alert tone="danger">{loadError}</Alert>
      </>
    );
  }
  if (!assessment) return <PageSpinner />;

  return (
    <>
      <PageHeader
        title={`Preview: ${assessment.title}`}
        description="Generate a sample question set in English to check the topic and difficulty. Each student gets their own set."
        backTo={`/instructor/assessments/${id}`}
        backLabel="Back to assessment"
        actions={
          <Button icon={questions ? FaRedo : FaMagic} loading={generating} onClick={generate}>
            {questions ? "Generate another sample" : "Generate sample questions"}
          </Button>
        }
      />

      {generateError && (
        <Alert tone="danger" className="mb-6">
          {generateError}
        </Alert>
      )}

      <Card>
        <CardHeader title="Sample questions" description="Correct answers are highlighted. Students never see this view." />
        {generating ? (
          <PageSpinner label="Generating questions with AI. This can take up to a minute…" />
        ) : !questions ? (
          <EmptyState icon={FaMagic} title="No sample yet" description="Generating a sample uses the AI, so it runs only when you ask." />
        ) : (
          <CardBody>
            <ol className="space-y-4">
              {questions.map((q, i) => {
                const dir = textDirection(q.question_text);
                const answer = answerText(q);
                return (
                  <li key={`${i}-${q.question_text}`} className="rounded-card border border-line p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink-muted">Question {i + 1}</span>
                      <Badge>
                        +{q.positive_marks}
                        {Number(q.negative_marks) > 0 ? ` / −${q.negative_marks}` : ""} · {q.duration_per_question}s
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
                            {opt === answer && <span className="sr-only">(correct answer)</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                    {!Array.isArray(q.options) && (
                      <p className="mt-3 text-sm text-ink-muted">
                        Correct answer: <span className="font-semibold text-ink">{answer}</span>
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
