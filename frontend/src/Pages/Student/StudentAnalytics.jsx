import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { FaChartBar, FaCheckCircle, FaClock, FaDownload, FaMinusCircle, FaTimesCircle } from "react-icons/fa";
import useStudentAnalyticsStore from "../../store/useStudentAnalyticsStore.js";
import AnswerReview from "../../components/assessment/AnswerReview.jsx";
import { Alert, Button, Card, CardBody, CardHeader, EmptyState, PageHeader, PageSpinner, Select, SkeletonList, StatCard } from "../../components/ui";

const formatSeconds = (s) => {
  const total = Math.round(Number(s) || 0);
  return `${Math.floor(total / 60)}m ${total % 60}s`;
};

function StudentAnalytics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    assessments,
    loading,
    error,
    questions,
    questionsLoading,
    selectedAssessmentDetails: details,
    downloading,
    fetchAssessments,
    fetchAssessmentDetails,
    fetchAssessmentQuestions,
    downloadReport,
  } = useStudentAnalyticsStore();

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  const completed = useMemo(() => (Array.isArray(assessments) ? assessments.filter((a) => a.status === "completed") : []), [assessments]);
  const requestedId = Number(searchParams.get("assessment"));
  const selectedId = completed.some((a) => a.id === requestedId) ? requestedId : completed[0]?.id;

  useEffect(() => {
    if (!selectedId) return;
    fetchAssessmentDetails(selectedId);
    fetchAssessmentQuestions(selectedId);
  }, [selectedId, fetchAssessmentDetails, fetchAssessmentQuestions]);

  const select = (id) => setSearchParams({ assessment: String(id) }, { replace: true });
  const unanswered = questions.filter((q) => !q.answered).length;

  return (
    <>
      <PageHeader title="Results & review" description="See how you did and review every question with the correct answers." />

      {loading && !completed.length ? (
        <Card>
          <SkeletonList rows={3} />
        </Card>
      ) : error ? (
        <Alert tone="danger" title="Could not load your results" action={<Button variant="secondary" onClick={() => fetchAssessments()}>Try again</Button>}>
          {error}
        </Alert>
      ) : completed.length === 0 ? (
        <Card>
          <EmptyState icon={FaChartBar} title="No results yet" description="Results appear here after you submit an assessment." action={<Button to="/student/dashboard">Go to dashboard</Button>} />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Assessment picker: dropdown on phones, list on large screens */}
          <div className="lg:col-span-1">
            <div className="lg:hidden">
              <Select
                label="Assessment"
                value={selectedId ?? ""}
                onChange={(e) => select(Number(e.target.value))}
                options={completed.map((a) => ({ value: a.id, label: `${a.title} (${a.percentage ?? 0}%)` }))}
              />
            </div>
            <Card className="hidden lg:block">
              <CardHeader title="Completed" />
              <ul className="p-2">
                {completed.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => select(a.id)}
                      aria-current={a.id === selectedId ? "true" : undefined}
                      className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-control px-3 text-start text-sm ${
                        a.id === selectedId ? "bg-primary-50 font-semibold text-primary-700" : "text-ink-muted hover:bg-gray-100"
                      }`}
                    >
                      <span className="truncate">{a.title}</span>
                      <span className="shrink-0 tabular-nums">{a.percentage ?? 0}%</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="space-y-6 lg:col-span-3">
            {!details ? (
              <PageSpinner label="Loading results…" />
            ) : (
              <>
                <Card>
                  <CardHeader
                    title={details.assessment_title}
                    description={`Score ${details.student_score} / ${details.total_marks}`}
                    actions={
                      <Button variant="secondary" icon={FaDownload} loading={downloading} onClick={() => downloadReport(selectedId)}>
                        Download report
                      </Button>
                    }
                  />
                  <CardBody>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <StatCard label="Score" value={`${details.score ?? 0}%`} icon={FaChartBar} />
                      <StatCard label="Correct" value={details.correct_answers} icon={FaCheckCircle} />
                      <StatCard label="Incorrect" value={details.incorrect_answers} icon={FaTimesCircle} />
                      <StatCard label="Time" value={formatSeconds(details.time_taken)} icon={FaClock} />
                    </div>
                    <p className="mt-4 text-sm text-ink-muted">
                      <FaMinusCircle className="me-1 inline" aria-hidden="true" />
                      {unanswered} unanswered · {Number(details.negative_marks_applied) || 0} marks deducted for wrong answers
                    </p>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader title="Review" description="Green is the correct answer; red marks your answer when it was wrong." />
                  <CardBody>{questionsLoading ? <PageSpinner label="Loading questions…" /> : <AnswerReview items={questions} />}</CardBody>
                </Card>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default StudentAnalytics;
