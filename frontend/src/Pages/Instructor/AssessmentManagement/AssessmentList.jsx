import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { FaChartBar, FaClipboardList, FaEdit, FaEye, FaPlus, FaPrint, FaSearch, FaTrash, FaUserPlus } from "react-icons/fa";
import useAssessmentStore from "../../../store/assessmentStore.js";
import PhysicalPaperModal from "../../../components/PhysicalPaperModal.jsx";
import AssessmentStatus from "../../../components/assessment/AssessmentStatus.jsx";
import { Alert, Button, Card, CardHeader, EmptyState, Modal, PageHeader, ResponsiveTable, SkeletonList } from "../../../components/ui";
import { errorMessage } from "../../../utils/forms.js";
import { formatDate, formatNumber } from "../../../utils/format.js";

const questionTotal = (a) => (a.question_blocks || []).reduce((sum, b) => sum + (Number(b.question_count) || 0), 0);
const isEditable = (a) => !a.is_executed && ["draft", "objectives_ready", undefined, null].includes(a.status);

function AssessmentList() {
  const { t } = useTranslation();
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
      setLoadError(errorMessage(error, t("assessments.loadFailed")));
    } finally {
      setLoading(false);
    }
  }, [getInstructorAssessments, t]);

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
      toast.success(t("assessments.deleted", { title: deleteTarget.title }));
    } catch (error) {
      toast.error(errorMessage(error, t("assessments.deleteFailed")));
    }
  };

  const columns = [
    {
      key: "title",
      header: t("assessments.assessment"),
      primary: true,
      render: (a) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{a.title}</span>
          <AssessmentStatus assessment={a} />
        </div>
      ),
    },
    { key: "questions", header: t("assessments.questions"), render: (a) => formatNumber(questionTotal(a)) },
    { key: "resources", header: t("nav.resources"), render: (a) => formatNumber((a.resources || []).length) },
    { key: "created_at", header: t("assessments.created"), render: (a) => formatDate(a.created_at) },
  ];

  return (
    <>
      <PageHeader
        title={t("nav.assessments")}
        description={t("assessments.listDescription")}
        actions={
          <Button to="/instructor/assessments/create" icon={FaPlus}>
            {t("nav.newAssessment")}
          </Button>
        }
      />

      <Card>
        <CardHeader
          title={t("assessments.all")}
          actions={
            <div className="relative w-full sm:w-72">
              <FaSearch className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
              <label htmlFor="assessment-search" className="sr-only">
                {t("assessments.search")}
              </label>
              <input
                id="assessment-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("assessments.searchPlaceholder")}
                className="min-h-11 w-full rounded-control border border-line-strong ps-9 pe-3 text-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
            </div>
          }
        />
        {loading ? (
          <SkeletonList rows={4} />
        ) : loadError ? (
          <div className="p-4 sm:p-6">
            <Alert
              tone="danger"
              title={t("assessments.loadFailedTitle")}
              action={
                <Button variant="secondary" onClick={load}>
                  {t("common.tryAgain")}
                </Button>
              }
            >
              {loadError}
            </Alert>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FaClipboardList}
            title={assessments.length ? t("assessments.noMatch") : t("assessments.none")}
            description={assessments.length ? undefined : t("assessments.firstDescription")}
            action={
              assessments.length ? undefined : (
                <Button to="/instructor/assessments/create" icon={FaPlus}>
                  {t("nav.newAssessment")}
                </Button>
              )
            }
          />
        ) : (
          <ResponsiveTable
            caption={t("nav.assessments")}
            columns={columns}
            rows={filtered}
            actions={(a) => (
              <>
                <Button to={`/instructor/assessments/${a.id}`} variant="secondary" icon={FaEye}>
                  {t("common.open")}
                </Button>
                <Button to={`/instructor/assessments/${a.id}/enroll`} variant="ghost" icon={FaUserPlus}>
                  {t("assessments.enroll")}
                </Button>
                <Button variant="ghost" icon={FaPrint} onClick={() => setPaperTarget(a)}>
                  {t("assessments.print")}
                </Button>
                {a.is_executed && (
                  <Button to={`/instructor/assessments/${a.id}/analytics`} variant="ghost" icon={FaChartBar}>
                    {t("assessments.results")}
                  </Button>
                )}
                {isEditable(a) && (
                  <Button to={`/instructor/assessments/${a.id}/edit`} variant="ghost" icon={FaEdit}>
                    {t("common.edit")}
                  </Button>
                )}
                {!a.is_executed && (
                  <Button variant="ghost" icon={FaTrash} className="text-danger-700 hover:bg-danger-50" onClick={() => setDeleteTarget(a)}>
                    {t("common.delete")}
                  </Button>
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
        title={deleteTarget ? t("assessments.deleteTitle", { title: deleteTarget.title }) : ""}
        onConfirm={confirmDelete}
        confirmText={t("assessments.deleteConfirm")}
        confirmVariant="danger"
      >
        {t("assessments.deleteBody")}
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
