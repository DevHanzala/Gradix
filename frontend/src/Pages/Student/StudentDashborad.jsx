import { useEffect } from "react";
import { Link } from "react-router-dom";
import { FaClipboardList, FaCheckCircle, FaClock, FaPlayCircle, FaRedo, FaChartBar } from "react-icons/fa";
import useAuthStore from "../../store/authStore";
import useStudentAnalyticsStore from "../../store/useStudentAnalyticsStore";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

const STATUS = {
  not_started: { label: "Not started", cls: "bg-blue-50 text-blue-700 ring-blue-200" },
  in_progress: { label: "In progress", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  completed: { label: "Completed", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
};

const formatDuration = (seconds) => {
  const minutes = Math.round((Number(seconds) || 0) / 60);
  return minutes < 1 ? "< 1 min" : `${minutes} min`;
};

function AssessmentAction({ assessment }) {
  if (assessment.status === "completed") {
    return (
      <Link to={`/student/analytics?assessment=${assessment.id}`} className="btn-secondary">
        <FaChartBar aria-hidden="true" /> View results
      </Link>
    );
  }
  const resuming = assessment.status === "in_progress";
  return (
    <Link to={`/student/assessments/${assessment.id}/take`} className="btn-primary">
      {resuming ? <FaRedo aria-hidden="true" /> : <FaPlayCircle aria-hidden="true" />}
      {resuming ? "Resume" : "Start"}
    </Link>
  );
}

function StudentDashboard() {
  const { user } = useAuthStore();
  const { assessments, loading, error, fetchAssessments } = useStudentAnalyticsStore();

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  const list = Array.isArray(assessments) ? assessments : [];
  const completed = list.filter((a) => a.status === "completed");
  const stats = [
    { label: "Enrolled", value: list.length, icon: FaClipboardList },
    { label: "Completed", value: completed.length, icon: FaCheckCircle },
    { label: "Pending", value: list.length - completed.length, icon: FaClock },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Welcome back{user?.name ? `, ${user.name}` : ""}</h1>
        <p className="mt-1 text-gray-600">Your assessments and progress.</p>
      </header>

      <section aria-label="Summary" className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const { label, value } = stat;
          return (
          <div key={label} className="flex items-center gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Icon aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm text-gray-500">{label}</p>
              <p className="text-2xl font-bold text-gray-900">{loading ? "–" : value}</p>
            </div>
          </div>
          );
        })}
      </section>

      <section aria-labelledby="assessments-heading" className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 id="assessments-heading" className="text-lg font-semibold text-gray-900">
            My assessments
          </h2>
          <button type="button" onClick={() => fetchAssessments()} className="btn-secondary" disabled={loading}>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="px-5 py-12 text-center">
            <p className="font-semibold text-red-700">Could not load your assessments.</p>
            <button type="button" onClick={() => fetchAssessments()} className="btn-secondary mt-4">
              Try again
            </button>
          </div>
        ) : list.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <FaClipboardList className="mx-auto text-4xl text-gray-300" aria-hidden="true" />
            <p className="mt-4 font-semibold text-gray-800">No assessments yet</p>
            <p className="mt-1 text-sm text-gray-500">When an instructor enrolls you, it will appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {list.map((a) => {
              const status = STATUS[a.status] || STATUS.not_started;
              return (
                <li key={a.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold text-gray-900">{a.title}</h3>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${status.cls}`}>{status.label}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {a.question_count} questions · {formatDuration(a.duration_seconds)}
                      {a.status === "completed" && a.percentage !== null ? ` · Score ${a.percentage}%` : ""}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <AssessmentAction assessment={a} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export default StudentDashboard;
