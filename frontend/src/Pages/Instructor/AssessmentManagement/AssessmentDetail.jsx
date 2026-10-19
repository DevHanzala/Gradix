import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FaBinoculars, FaChartBar, FaEdit, FaLink, FaListOl, FaPrint, FaUserPlus } from "react-icons/fa";
import AssessmentStatus, { StatusSteps } from "../../../components/assessment/AssessmentStatus.jsx";
import useAssessmentStore from "../../../store/assessmentStore.js";
import PhysicalPaperModal from "../../../components/PhysicalPaperModal.jsx";
import { Alert, Button, Card, CardBody, CardHeader, PageHeader, PageSpinner, ResponsiveTable } from "../../../components/ui";
import { errorMessage } from "../../../utils/forms.js";

const TYPE_LABEL = { multiple_choice: "Multiple choice", true_false: "True / False", short_answer: "Short answer" };

function AssessmentDetail() {
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
      .catch((error) => active && setLoadError(errorMessage(error, "Could not load this assessment.")));
    return () => {
      active = false;
    };
  }, [id, getAssessmentById]);

  if (loadError) {
    return (
      <>
        <PageHeader title="Assessment" backTo="/instructor/assessments" backLabel="All assessments" />
        <Alert tone="danger" title="Could not load the assessment">
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

  return (
    <>
      <PageHeader
        title={assessment.title}
        description={assessment.is_executed ? "Students have started this assessment, so its settings are locked." : "Not started yet: you can still edit it."}
        backTo="/instructor/assessments"
        backLabel="All assessments"
        actions={
          <>
            {!assessment.is_executed && (
              <Button to={`/instructor/assessments/${id}/edit`} icon={FaEdit}>
                Edit
              </Button>
            )}
            <Button to={`/instructor/assessments/${id}/objectives`} variant="secondary" icon={FaListOl}>
              Objectives
            </Button>
            <Button to={`/instructor/assessments/${id}/enroll`} variant="secondary" icon={FaUserPlus}>
              Enroll students
            </Button>
            <Button variant="secondary" icon={FaPrint} onClick={() => setPaperOpen(true)}>
              Print paper
            </Button>
            <Button to={`/instructor/assessments/${id}/preview`} variant="secondary" icon={FaBinoculars}>
              Preview
            </Button>
            <Button to={`/instructor/assessments/${id}/analytics`} variant="secondary" icon={FaChartBar}>
              Results
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Prompt" />
            <CardBody>
              {assessment.prompt ? (
                <p className="whitespace-pre-wrap text-ink">{assessment.prompt}</p>
              ) : (
                <p className="text-ink-subtle">No prompt. Questions are generated from the selected material.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Question blocks" description={`${totalQuestions} questions · ${Math.round(totalSeconds / 60)} min · ${totalMarks} marks`} />
            <ResponsiveTable
              caption="Question blocks"
              rowKey={(b) => `${b.question_type}-${b.question_count}-${b.duration_per_question}-${blocks.indexOf(b)}`}
              rows={blocks}
              columns={[
                { key: "question_type", header: "Type", primary: true, render: (b) => TYPE_LABEL[b.question_type] || b.question_type },
                { key: "question_count", header: "Questions" },
                { key: "duration_per_question", header: "Seconds each" },
                { key: "positive_marks", header: "Correct", render: (b) => `+${Number(b.positive_marks)}` },
                {
                  key: "negative_marks",
                  header: "Wrong",
                  render: (b) => (Number(b.negative_marks) > 0 ? `−${Number(b.negative_marks)}` : "0"),
                },
              ]}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Status" />
            <CardBody className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">State</span>
                <AssessmentStatus assessment={assessment} />
              </div>
              <StatusSteps assessment={assessment} />
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-muted">Created</span>
                <span>{assessment.created_at ? new Date(assessment.created_at).toLocaleString() : "–"}</span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Source material" />
            <CardBody className="space-y-4 text-sm">
              {(assessment.resources || []).length === 0 && links.length === 0 ? (
                <p className="text-ink-subtle">No resources or links.</p>
              ) : (
                <>
                  {(assessment.resources || []).length > 0 && (
                    <ul className="space-y-1">
                      {assessment.resources.map((r) => (
                        <li key={r.id} className="break-words text-ink">
                          {r.name}
                        </li>
                      ))}
                    </ul>
                  )}
                  {links.length > 0 && (
                    <ul className="space-y-1">
                      {links.map((l) => (
                        <li key={l} className="flex items-start gap-2 break-all">
                          <FaLink className="mt-1 shrink-0 text-ink-subtle" aria-hidden="true" />
                          <a href={l} target="_blank" rel="noreferrer" className="text-primary-700 hover:underline">
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
