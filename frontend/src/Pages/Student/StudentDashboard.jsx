import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FaChartBar, FaCheckCircle, FaClipboardList, FaClock, FaPlayCircle, FaRedo } from "react-icons/fa";
import useAuthStore from "../../store/authStore";
import useStudentAnalyticsStore from "../../store/useStudentAnalyticsStore";
import { formatDuration, formatNumber, formatPercent } from "../../utils/format.js";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageHeader, SkeletonList, StatCard } from "../../components/ui";

const STATUS_TONE = { not_started: "primary", in_progress: "warning", completed: "success" };

function AssessmentAction({ assessment }) {
  const { t } = useTranslation();
  if (assessment.status === "completed") {
    return (
      <Button to={`/student/results/${assessment.id}`} variant="secondary" icon={FaChartBar} className="w-full sm:w-auto">
        {t("studentDashboard.viewResults")}
      </Button>
    );
  }
  const resuming = assessment.status === "in_progress";
  if (!resuming && (assessment.available_languages || []).length === 0) {
    return <Badge tone="neutral">{t("studentDashboard.notAvailable")}</Badge>;
  }
  return (
    <Button to={`/student/assessments/${assessment.id}/take`} icon={resuming ? FaRedo : FaPlayCircle} className="w-full sm:w-auto">
      {resuming ? t("studentDashboard.resume") : t("studentDashboard.start")}
    </Button>
  );
}

function StudentDashboard() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { assessments, loading, error, fetchAssessments } = useStudentAnalyticsStore();

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  const list = Array.isArray(assessments) ? assessments : [];
  const completed = list.filter((a) => a.status === "completed").length;
  const stat = (value) => (loading ? "–" : formatNumber(value));

  return (
    <>
      <PageHeader
        title={user?.name ? t("studentDashboard.welcomeName", { name: user.name }) : t("studentDashboard.welcome")}
        description={t("studentDashboard.description")}
      />

      <section aria-label={t("dashboard.summary")} className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={t("studentDashboard.enrolled")} value={stat(list.length)} icon={FaClipboardList} />
        <StatCard label={t("studentDashboard.completed")} value={stat(completed)} icon={FaCheckCircle} />
        <StatCard label={t("studentDashboard.pending")} value={stat(list.length - completed)} icon={FaClock} />
      </section>

      <Card>
        <CardHeader
          title={t("studentDashboard.myAssessments")}
          actions={
            <Button variant="secondary" onClick={() => fetchAssessments()} disabled={loading}>
              {t("common.refresh")}
            </Button>
          }
        />
        {loading ? (
          <SkeletonList rows={3} />
        ) : error ? (
          <div className="p-4 sm:p-6">
            <Alert
              tone="danger"
              title={t("studentDashboard.loadFailed")}
              action={
                <Button variant="secondary" onClick={() => fetchAssessments()}>
                  {t("common.tryAgain")}
                </Button>
              }
            >
              {error}
            </Alert>
          </div>
        ) : list.length === 0 ? (
          <EmptyState icon={FaClipboardList} title={t("assessments.none")} description={t("studentDashboard.noneDescription")} />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((a) => (
              <li key={a.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-ink">{a.title}</h3>
                    <Badge tone={STATUS_TONE[a.status] || "primary"}>{t(`studentDashboard.status.${a.status || "not_started"}`)}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">
                    {t("studentDashboard.questionCount", { count: a.question_count })} · {formatDuration(a.duration_seconds)}
                    {a.status === "completed" && a.percentage !== null
                      ? ` · ${t("studentDashboard.score", { value: formatPercent(a.percentage) })}`
                      : ""}
                  </p>
                </div>
                <AssessmentAction assessment={a} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

export default StudentDashboard;
