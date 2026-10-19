import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FaChartBar, FaClipboardList, FaEdit, FaEye, FaPlus, FaPrint, FaSearch, FaTrash, FaUserPlus } from "react-icons/fa";
import useAssessmentStore from "../../../store/assessmentStore.js";
import PhysicalPaperModal from "../../../components/PhysicalPaperModal.jsx";
import AssessmentStatus from "../../../components/assessment/AssessmentStatus.jsx";
import { Alert, Button, Card, CardHeader, EmptyState, Modal, PageHeader, ResponsiveTable, SkeletonList } from "../../../components/ui";
import { errorMessage } from "../../../utils/forms.js";

const questionTotal = (a) => (a.question_blocks || []).reduce((sum, b) => sum + (Number(b.question_count) || 0), 0);

function AssessmentList() {
  const { assessments, getInstructorAssessments, deleteAssessment } = useAssessmentStore();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [paperTarget, setPaperTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      await getInstructorAssessments();
    } catch (error) {
      setLoadError(errorMessage(error, "Could not load assessments."));
    } finally {
      setLoading(false);
    }
  }, [getInstructorAssessments]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? assessments.filter((a) => a.title?.toLowerCase().includes(q)) : assessments;
  }, [assessments, query]);

  const confirmDelete = async () => {
    try {
      await deleteAssessment(deleteTarget.id);
      toast.success(`"${deleteTarget.title}" was deleted.`);
    } catch (error) {
      toast.error(errorMessage(error, "Could not delete the assessment."));
    }
  };

  const columns = [
    {
      key: "title",
      header: "Assessment",
      primary: true,
      render: (a) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{a.title}</span>
          <AssessmentStatus assessment={a} />
        </div>
      ),
    },
    { key: "questions", header: "Questions", render: (a) => questionTotal(a) },
    { key: "resources", header: "Resources", render: (a) => (a.resources || []).length },
    { key: "created_at", header: "Created", render: (a) => (a.created_at ? new Date(a.created_at).toLocaleDateString() : "–") },
  ];

  return (
    <>
      <PageHeader
        title="Assessments"
        description="Create, enroll, print and review your assessments."
        actions={
          <Button to="/instructor/assessments/create" icon={FaPlus}>
            New assessment
          </Button>
        }
      />

      <Card>
        <CardHeader
          title="All assessments"
          actions={
            <div className="relative w-full sm:w-72">
              <FaSearch className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
              <label htmlFor="assessment-search" className="sr-only">
                Search assessments
              </label>
              <input
                id="assessment-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title"
                className="min-h-11 w-full rounded-control border border-line-strong ps-9 pe-3 text-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
            </div>
          }
        />
        {loading ? (
          <SkeletonList rows={4} />
        ) : loadError ? (
          <div className="p-4 sm:p-6">
            <Alert tone="danger" title="Could not load assessments" action={<Button variant="secondary" onClick={load}>Try again</Button>}>
              {loadError}
            </Alert>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FaClipboardList}
            title={assessments.length ? "No assessments match your search" : "No assessments yet"}
            description={assessments.length ? undefined : "Create your first assessment from a prompt or your teaching material."}
            action={
              assessments.length ? undefined : (
                <Button to="/instructor/assessments/create" icon={FaPlus}>
                  New assessment
                </Button>
              )
            }
          />
        ) : (
          <ResponsiveTable
            caption="Assessments"
            columns={columns}
            rows={filtered}
            actions={(a) => (
              <>
                <Button to={`/instructor/assessments/${a.id}`} variant="secondary" icon={FaEye}>
                  Open
                </Button>
                <Button to={`/instructor/assessments/${a.id}/enroll`} variant="ghost" icon={FaUserPlus}>
                  Enroll
                </Button>
                <Button variant="ghost" icon={FaPrint} onClick={() => setPaperTarget(a)}>
                  Print
                </Button>
                {a.is_executed ? (
                  <Button to={`/instructor/assessments/${a.id}/analytics`} variant="ghost" icon={FaChartBar}>
                    Results
                  </Button>
                ) : (
                  <>
                    <Button to={`/instructor/assessments/${a.id}/edit`} variant="ghost" icon={FaEdit}>
                      Edit
                    </Button>
                    <Button variant="ghost" icon={FaTrash} className="text-danger-700 hover:bg-danger-50" onClick={() => setDeleteTarget(a)}>
                      Delete
                    </Button>
                  </>
                )}
              </>
            )}
          />
        )}
      </Card>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        type="warning"
        title={deleteTarget ? `Delete "${deleteTarget.title}"?` : ""}
        onConfirm={confirmDelete}
        confirmText="Delete assessment"
        confirmVariant="danger"
      >
        This removes the assessment, its question blocks and enrollments. It cannot be undone.
      </Modal>

      <PhysicalPaperModal
        isOpen={Boolean(paperTarget)}
        onClose={() => setPaperTarget(null)}
        assessmentId={paperTarget?.id}
        assessmentTitle={paperTarget?.title}
      />
    </>
  );
}

export default AssessmentList;
