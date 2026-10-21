import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FaChartBar } from "react-icons/fa";
import useStudentAnalyticsStore from "../../store/useStudentAnalyticsStore.js";
import { formatDate, formatPercent } from "../../utils/format.js";
import { Alert, Button, Card, CardHeader, EmptyState, PageHeader, SkeletonList } from "../../components/ui";

/** All completed assessments; each opens its results page. */
function StudentAnalytics() {
  const { t } = useTranslation();
  const { assessments, loading, error, fetchAssessments } = useStudentAnalyticsStore();

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  const completed = useMemo(() => (Array.isArray(assessments) ? assessments.filter((a) => a.status === "completed") : []), [assessments]);

  return (
    <>
      <PageHeader title={t("nav.results")} description={t("results.listDescription")} />
      <Card>
        <CardHeader title={t("studentDashboard.completed")} />
        {loading && !completed.length ? (
          <SkeletonList rows={3} />
        ) : error ? (
          <div className="p-4 sm:p-6">
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
          </div>
        ) : completed.length === 0 ? (
          <EmptyState
            icon={FaChartBar}
            title={t("results.none")}
            description={t("results.noneDescription")}
            action={<Button to="/student/dashboard">{t("profile.goToDashboard")}</Button>}
          />
        ) : (
          <ul className="divide-y divide-line">
            {completed.map((a) => (
              <li key={a.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{a.title}</p>
                  <p className="text-sm text-ink-muted">
                    {t("studentDashboard.score", { value: formatPercent(a.percentage ?? 0) })} · {formatDate(a.completed_at)}
                  </p>
                </div>
                <Button to={`/student/results/${a.id}`} variant="secondary" icon={FaChartBar} className="w-full sm:w-auto">
                  {t("studentDashboard.viewResults")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

export default StudentAnalytics;
