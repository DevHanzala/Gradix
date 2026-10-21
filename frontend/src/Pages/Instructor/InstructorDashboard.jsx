import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaChartBar, FaClipboardCheck, FaClipboardList, FaFolderOpen, FaPlus, FaUserPlus } from "react-icons/fa";
import useAuthStore from "../../store/authStore.js";
import useAssessmentStore from "../../store/assessmentStore.js";
import useInstructorAnalyticsStore from "../../store/useInstructorAssessmentAnalyticsStore.js";
import AssessmentStatus from "../../components/assessment/AssessmentStatus.jsx";
import { Alert, Button, Card, CardHeader, EmptyState, PageHeader, SkeletonList, StatCard } from "../../components/ui";
import { errorMessage } from "../../utils/forms.js";
import { formatNumber } from "../../utils/format.js";

function InstructorDashboard() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { assessments, getInstructorAssessments } = useAssessmentStore();
  const { overview, getInstructorOverview } = useInstructorAnalyticsStore();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([getInstructorAssessments(), getInstructorOverview()])
      .catch((error) => active && setLoadError(errorMessage(error, t("dashboard.loadFailed"))))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [getInstructorAssessments, getInstructorOverview, t]);

  const recent = (assessments || []).slice(0, 5);
  const stat = (value) => (loading ? "–" : formatNumber(value ?? 0));

  return (
    <>
      <PageHeader
        title={user?.name ? t("dashboard.welcomeName", { name: user.name }) : t("dashboard.welcome")}
        description={t("dashboard.instructorDescription")}
        actions={
          <Button to="/instructor/assessments/create" icon={FaPlus}>
            {t("nav.newAssessment")}
          </Button>
        }
      />

      {loadError && (
        <Alert tone="danger" className="mb-6">
          {loadError}
        </Alert>
      )}

      <section aria-label={t("dashboard.summary")} className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={t("nav.assessments")} value={stat(overview?.assessments)} icon={FaClipboardList} />
        <StatCard label={t("dashboard.startedByStudents")} value={stat(overview?.executedAssessments)} icon={FaClipboardCheck} />
        <StatCard label={t("nav.resources")} value={stat(overview?.resources)} icon={FaFolderOpen} />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title={t("dashboard.recentAssessments")}
            actions={
              <Button to="/instructor/assessments" variant="secondary">
                {t("common.viewAll")}
              </Button>
            }
          />
          {loading ? (
            <SkeletonList rows={3} />
          ) : recent.length === 0 ? (
            <EmptyState
              icon={FaClipboardList}
              title={t("assessments.none")}
              description={t("assessments.noneDescription")}
              action={
                <Button to="/instructor/assessments/create" icon={FaPlus}>
                  {t("nav.newAssessment")}
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((a) => (
                <li key={a.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{a.title}</p>
                    <div className="mt-1">
                      <AssessmentStatus assessment={a} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button to={`/instructor/assessments/${a.id}`} variant="secondary">
                      {t("common.open")}
                    </Button>
                    <Button to={`/instructor/assessments/${a.id}/enroll`} variant="ghost" icon={FaUserPlus}>
                      {t("assessments.enroll")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title={t("dashboard.quickActions")} />
          <div className="grid gap-2 p-4 sm:p-6">
            <Button to="/instructor/assessments/create" variant="secondary" icon={FaPlus} fullWidth>
              {t("nav.newAssessment")}
            </Button>
            <Button to="/instructor/resources" variant="secondary" icon={FaFolderOpen} fullWidth>
              {t("dashboard.uploadResources")}
            </Button>
            <Button to="/instructor/students" variant="secondary" icon={FaUserPlus} fullWidth>
              {t("students.registerTitle")}
            </Button>
            <Button to="/instructor/assessments" variant="secondary" icon={FaChartBar} fullWidth>
              {t("dashboard.resultsByAssessment")}
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}

export default InstructorDashboard;
