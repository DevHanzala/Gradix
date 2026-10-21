import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaBinoculars, FaChartBar, FaDatabase, FaEdit, FaLink, FaListOl, FaPrint, FaUserPlus } from "react-icons/fa";
import AssessmentStatus, { StatusSteps } from "../../../components/assessment/AssessmentStatus.jsx";
import useAssessmentStore from "../../../store/assessmentStore.js";
import PhysicalPaperModal from "../../../components/PhysicalPaperModal.jsx";
import { Alert, Button, Card, CardBody, CardHeader, PageHeader, PageSpinner, ResponsiveTable } from "../../../components/ui";
import { errorMessage } from "../../../utils/forms.js";
import { formatDateTime, formatDuration, formatNumber } from "../../../utils/format.js";
import { textDirection } from "../../../utils/text.js";

function AssessmentDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { getAssessmentById } = useAssessmentStore();
  const [assessment, setAssessment] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [paperOpen, setPaperOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadError(null);
    setAssessment(null);
    getAssessmentById(id)
      .then((data) => active && setAssessment(data))
      .catch((error) => active && setLoadError(errorMessage(error, t("assessments.loadOneFailed"))));
    return () => {
      active = false;
    };
  }, [id, getAssessmentById, t]);

  if (loadError) {
    return (
      <>
        <PageHeader title={t("assessments.assessment")} backTo="/instructor/assessments" backLabel={t("assessments.all")} />
        <Alert tone="danger" title={t("assessments.loadOneFailedTitle")}>
          {loadError}
        </Alert>
      </>
    );
  }
  if (!assessment) return <PageSpinner />;

  const blocks = assessment.question_blocks || [];
  const totalQuestions = blocks.reduce((s, b) => s + Number(b.question_count || 0), 0);
  const totalSeconds = blocks.reduce((s, b) => s + Number(b.question_count || 0) * Number(b.duration_per_question || 0), 0);
  const totalMarks = blocks.reduce((s, b) => s + Number(b.question_count || 0) * Number(b.positive_marks || 0), 0);
  const links = assessment.external_links || [];
  const editable = !assessment.is_executed && ["draft", "objectives_ready"].includes(assessment.status || "draft");

  return (
    <>
      <PageHeader
        title={assessment.title}
        description={editable ? t("detail.editableDescription") : t("detail.lockedDescription")}
        backTo="/instructor/assessments"
        backLabel={t("assessments.all")}
        actions={
          <>
            {editable && (
              <Button to={`/instructor/assessments/${id}/edit`} icon={FaEdit}>
                {t("common.edit")}
              </Button>
            )}
            <Button to={`/instructor/assessments/${id}/objectives`} variant="secondary" icon={FaListOl}>
              {t("detail.objectivesAndPublishing")}
            </Button>
            {["publishing", "published"].includes(assessment.status) && (
              <Button to={`/instructor/assessments/${id}/questions`} variant="secondary" icon={FaDatabase}>
                {t("bank.title")}
              </Button>
            )}
            <Button to={`/instructor/assessments/${id}/enroll`} variant="secondary" icon={FaUserPlus}>
              {t("enroll.title")}
            </Button>
            <Button variant="secondary" icon={FaPrint} onClick={() => setPaperOpen(true)}>
              {t("detail.printPaper")}
            </Button>
            <Button to={`/instructor/assessments/${id}/preview`} variant="secondary" icon={FaBinoculars}>
              {t("preview.title")}
            </Button>
            <Button to={`/instructor/assessments/${id}/analytics`} variant="secondary" icon={FaChartBar}>
              {t("assessments.results")}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title={t("form.prompt")} />
            <CardBody>
              {assessment.prompt ? (
                <p className="whitespace-pre-wrap text-ink" dir={textDirection(assessment.prompt)}>
                  {assessment.prompt}
                </p>
              ) : (
                <p className="text-ink-subtle">{t("detail.noPrompt")}</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={t("detail.blocks")}
              description={t("detail.blocksSummary", {
                questions: formatNumber(totalQuestions),
                duration: formatDuration(totalSeconds),
                marks: formatNumber(totalMarks),
              })}
            />
            <ResponsiveTable
              caption={t("detail.blocks")}
              rowKey={(b) => `${b.question_type}-${b.question_count}-${b.duration_per_question}-${blocks.indexOf(b)}`}
              rows={blocks}
              columns={[
                { key: "question_type", header: t("resources.type"), primary: true, render: (b) => t(`questionTypes.${b.question_type}`) },
                { key: "question_count", header: t("assessments.questions"), render: (b) => formatNumber(b.question_count) },
                { key: "duration_per_question", header: t("detail.secondsEach"), render: (b) => formatNumber(b.duration_per_question) },
                { key: "positive_marks", header: t("detail.correctMarks"), render: (b) => <span dir="ltr">+{Number(b.positive_marks)}</span> },
                {
                  key: "negative_marks",
                  header: t("detail.wrongMarks"),
                  render: (b) => <span dir="ltr">{Number(b.negative_marks) > 0 ? `−${Number(b.negative_marks)}` : "0"}</span>,
                },
              ]}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t("users.status")} />
            <CardBody className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">{t("detail.state")}</span>
                <AssessmentStatus assessment={assessment} />
              </div>
              <StatusSteps assessment={assessment} />
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">{t("detail.mode")}</span>
                <span>{assessment.adaptive ? t("form.adaptive") : t("detail.fixedDifficulty")}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">{t("assessments.created")}</span>
                <span>{formatDateTime(assessment.created_at)}</span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("form.sourceMaterial")} />
            <CardBody className="space-y-4 text-sm">
              {(assessment.resources || []).length === 0 && links.length === 0 ? (
                <p className="text-ink-subtle">{t("detail.noSources")}</p>
              ) : (
                <>
                  {(assessment.resources || []).length > 0 && (
                    <ul className="space-y-1">
                      {assessment.resources.map((r) => (
                        <li key={r.id} className="break-words text-ink" dir="auto">
                          {r.name}
                        </li>
                      ))}
                    </ul>
                  )}
                  {links.length > 0 && (
                    <ul className="space-y-1">
                      {links.map((l) => (
                        <li key={l} className="flex items-center gap-2 break-all">
                          <FaLink className="shrink-0 text-ink-subtle" aria-hidden="true" />
                          <a href={l} target="_blank" rel="noreferrer" dir="ltr" className="inline-flex min-h-11 items-center text-primary-700 hover:underline">
                            {l}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <PhysicalPaperModal isOpen={paperOpen} onClose={() => setPaperOpen(false)} assessmentId={assessment.id} assessmentTitle={assessment.title} />
    </>
  );
}

export default AssessmentDetail;
