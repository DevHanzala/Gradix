import { useEffect } from "react";
import { FaChartBar, FaCheckCircle, FaClipboardList, FaClock, FaPlayCircle, FaRedo } from "react-icons/fa";
import useAuthStore from "../../store/authStore";
import useStudentAnalyticsStore from "../../store/useStudentAnalyticsStore";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, PageHeader, SkeletonList, StatCard } from "../../components/ui";

const STATUS = {
  not_started: { label: "Not started", tone: "primary" },
  in_progress: { label: "In progress", tone: "warning" },
  completed: { label: "Completed", tone: "success" },
};

const formatDuration = (seconds) => {
  const minutes = Math.round((Number(seconds) || 0) / 60);
  return minutes < 1 ? "under 1 min" : `${minutes} min`;
};

function AssessmentAction({ assessment }) {
  if (assessment.status === "completed") {
    return (
      <Button to={`/student/analytics?assessment=${assessment.id}`} variant="secondary" icon={FaChartBar} className="w-full sm:w-auto">
        View results
      </Button>
    );
  }
  const resuming = assessment.status === "in_progress";
  return (
    <Button to={`/student/assessments/${assessment.id}/take`} icon={resuming ? FaRedo : FaPlayCircle} className="w-full sm:w-auto">
      {resuming ? "Resume" : "Start"}
    </Button>
  );
}

function StudentDashboard() {
  const { user } = useAuthStore();
  const { assessments, loading, error, fetchAssessments } = useStudentAnalyticsStore();

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  const list = Array.isArray(assessments) ? assessments : [];
  const completed = list.filter((a) => a.status === "completed").length;

  return (
    <>
      <PageHeader title={`Welcome back${user?.name ? `, ${user.name}` : ""}`} description="Your assessments and progress." />

      <section aria-label="Summary" className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Enrolled" value={loading ? "–" : list.length} icon={FaClipboardList} />
        <StatCard label="Completed" value={loading ? "–" : completed} icon={FaCheckCircle} />
        <StatCard label="Pending" value={loading ? "–" : list.length - completed} icon={FaClock} />
      </section>

      <Card>
        <CardHeader
          title="My assessments"
          actions={
            <Button variant="secondary" onClick={() => fetchAssessments()} disabled={loading}>
              Refresh
            </Button>
          }
        />
        {loading ? (
          <SkeletonList rows={3} />
        ) : error ? (
          <div className="p-4 sm:p-6">
            <Alert tone="danger" title="Could not load your assessments" action={<Button variant="secondary" onClick={() => fetchAssessments()}>Try again</Button>}>
              {error}
            </Alert>
          </div>
        ) : list.length === 0 ? (
          <EmptyState icon={FaClipboardList} title="No assessments yet" description="When an instructor enrolls you, it will appear here." />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((a) => {
              const status = STATUS[a.status] || STATUS.not_started;
              return (
                <li key={a.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-ink">{a.title}</h3>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">
                      {a.question_count} questions · {formatDuration(a.duration_seconds)}
                      {a.status === "completed" && a.percentage !== null ? ` · Score ${a.percentage}%` : ""}
                    </p>
                  </div>
                  <AssessmentAction assessment={a} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

export default StudentDashboard;
