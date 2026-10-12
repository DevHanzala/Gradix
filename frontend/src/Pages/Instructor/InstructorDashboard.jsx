import { useEffect, useState } from "react";
import { FaChartBar, FaClipboardCheck, FaClipboardList, FaFolderOpen, FaPlus, FaUserPlus } from "react-icons/fa";
import useAuthStore from "../../store/authStore.js";
import useAssessmentStore from "../../store/assessmentStore.js";
import useInstructorAnalyticsStore from "../../store/useInstructorAssessmentAnalyticsStore.js";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageHeader, SkeletonList, StatCard } from "../../components/ui";
import { errorMessage } from "../../utils/forms.js";

function InstructorDashboard() {
  const { user } = useAuthStore();
  const { assessments, getInstructorAssessments } = useAssessmentStore();
  const { overview, getInstructorOverview } = useInstructorAnalyticsStore();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([getInstructorAssessments(), getInstructorOverview()])
      .catch((error) => active && setLoadError(errorMessage(error, "Could not load your dashboard.")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [getInstructorAssessments, getInstructorOverview]);

  const recent = (assessments || []).slice(0, 5);
  const stat = (value) => (loading ? "–" : value ?? 0);

  return (
    <>
      <PageHeader
        title={`Welcome${user?.name ? `, ${user.name}` : ""}`}
        description="Create assessments, enroll students and review results."
        actions={
          <Button to="/instructor/assessments/create" icon={FaPlus}>
            New assessment
          </Button>
        }
      />

      {loadError && (
        <Alert tone="danger" className="mb-6">
          {loadError}
        </Alert>
      )}

      <section aria-label="Summary" className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Assessments" value={stat(overview?.assessments)} icon={FaClipboardList} />
        <StatCard label="Started by students" value={stat(overview?.executedAssessments)} icon={FaClipboardCheck} />
        <StatCard label="Resources" value={stat(overview?.resources)} icon={FaFolderOpen} />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent assessments"
            actions={
              <Button to="/instructor/assessments" variant="secondary">
                View all
              </Button>
            }
          />
          {loading ? (
            <SkeletonList rows={3} />
          ) : recent.length === 0 ? (
            <EmptyState
              icon={FaClipboardList}
              title="No assessments yet"
              description="Create one from a short prompt or your own material."
              action={
                <Button to="/instructor/assessments/create" icon={FaPlus}>
                  New assessment
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((a) => (
                <li key={a.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{a.title}</p>
                    <div className="mt-1">{a.is_executed ? <Badge tone="warning">Started · locked</Badge> : <Badge tone="primary">Draft</Badge>}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button to={`/instructor/assessments/${a.id}`} variant="secondary">
                      Open
                    </Button>
                    <Button to={`/instructor/assessments/${a.id}/enroll`} variant="ghost" icon={FaUserPlus}>
                      Enroll
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Quick actions" />
          <div className="grid gap-2 p-4 sm:p-6">
            <Button to="/instructor/assessments/create" variant="secondary" icon={FaPlus} fullWidth>
              New assessment
            </Button>
            <Button to="/instructor/resources" variant="secondary" icon={FaFolderOpen} fullWidth>
              Upload resources
            </Button>
            <Button to="/instructor/students" variant="secondary" icon={FaUserPlus} fullWidth>
              Register a student
            </Button>
            <Button to="/instructor/assessments" variant="secondary" icon={FaChartBar} fullWidth>
              Results by assessment
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}

export default InstructorDashboard;
