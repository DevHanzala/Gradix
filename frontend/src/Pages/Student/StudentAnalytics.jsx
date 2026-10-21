import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaChartBar, FaCheckCircle, FaClock, FaDownload, FaMinusCircle, FaTimesCircle } from "react-icons/fa";
import useStudentAnalyticsStore from "../../store/useStudentAnalyticsStore.js";
import AnswerReview from "../../components/assessment/AnswerReview.jsx";
import { formatDuration, formatNumber, formatPercent } from "../../utils/format.js";
import { Alert, Button, Card, CardBody, CardHeader, EmptyState, PageHeader, PageSpinner, Select, SkeletonList, StatCard } from "../../components/ui";

function StudentAnalytics() {
  const { t } = useTranslation();
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
      <PageHeader title={t("nav.results")} description={t("results.listDescription")} />

      {loading && !completed.length ? (
        <Card>
          <SkeletonList rows={3} />
        </Card>
      ) : error ? (
        <Alert
          tone="danger"
          title={t("results.loadFailed")}
          action={
            <Button variant="secondary" onClick={() => fetchAssessments()}>
              {t("common.tryAgain")}
            </Button>
          }
        >
          {error}
        </Alert>
      ) : completed.length === 0 ? (
        <Card>
          <EmptyState
            icon={FaChartBar}
            title={t("results.none")}
            description={t("results.noneDescription")}
            action={<Button to="/student/dashboard">{t("profile.goToDashboard")}</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Assessment picker: dropdown on phones, list on large screens */}
          <div className="lg:col-span-1">
            <div className="lg:hidden">
              <Select
                label={t("assessments.assessment")}
                value={selectedId ?? ""}
                onChange={(e) => select(Number(e.target.value))}
                options={completed.map((a) => ({ value: a.id, label: `${a.title} (${formatPercent(a.percentage ?? 0)})` }))}
              />
            </div>
            <Card className="hidden lg:block">
              <CardHeader title={t("studentDashboard.completed")} />
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
                      <span className="shrink-0 tabular-nums">{formatPercent(a.percentage ?? 0)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="space-y-6 lg:col-span-3">
            {!details ? (
              <PageSpinner label={t("results.loading")} />
            ) : (
              <>
                <Card>
                  <CardHeader
                    title={details.assessment_title}
                    description={t("results.scoreOf", { score: formatNumber(details.student_score), total: formatNumber(details.total_marks) })}
                    actions={
                      <Button variant="secondary" icon={FaDownload} loading={downloading} onClick={() => downloadReport(selectedId)}>
                        {t("results.downloadReport")}
                      </Button>
                    }
                  />
                  <CardBody>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <StatCard label={t("analytics.score")} value={formatPercent(details.score ?? 0)} icon={FaChartBar} />
                      <StatCard label={t("analytics.correct")} value={formatNumber(details.correct_answers)} icon={FaCheckCircle} />
                      <StatCard label={t("results.incorrect")} value={formatNumber(details.incorrect_answers)} icon={FaTimesCircle} />
                      <StatCard label={t("analytics.time")} value={formatDuration(details.time_taken)} icon={FaClock} />
                    </div>
                    <p className="mt-4 text-sm text-ink-muted">
                      <FaMinusCircle className="me-1 inline" aria-hidden="true" />
                      {t("results.unansweredDeducted", {
                        unanswered: formatNumber(unanswered),
                        deducted: formatNumber(Number(details.negative_marks_applied) || 0),
                      })}
                    </p>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader title={t("results.review")} description={t("results.reviewDescription")} />
                  <CardBody>{questionsLoading ? <PageSpinner label={t("results.loadingQuestions")} /> : <AnswerReview items={questions} />}</CardBody>
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
