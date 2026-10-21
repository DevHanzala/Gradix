import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { FaLock } from "react-icons/fa";
import useAssessmentStore from "../../../store/assessmentStore.js";
import AssessmentForm from "../../../components/assessment/AssessmentForm.jsx";
import { formValuesFromAssessment } from "../../../components/assessment/assessmentFormValues.js";
import { Alert, Button, PageHeader, PageSpinner } from "../../../components/ui";
import { errorMessage } from "../../../utils/forms.js";

function EditAssessment() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { getAssessmentById, updateAssessment } = useAssessmentStore();
  const [assessment, setAssessment] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoadError(null);
    getAssessmentById(id)
      .then((data) => active && setAssessment(data))
      .catch((error) => active && setLoadError(errorMessage(error, t("assessments.loadOneFailed"))));
    return () => {
      active = false;
    };
  }, [id, getAssessmentById, t]);

  const handleSubmit = async (formData) => {
    const updated = await updateAssessment(Number(id), formData);
    toast.success(t("assessments.updatedToast"));
    if (updated?.skippedLinks?.length) toast.error(t("form.linksSkipped", { links: updated.skippedLinks.map((l) => l.url).join(", ") }));
    navigate(`/instructor/assessments/${id}`);
  };

  const header = <PageHeader title={t("assessments.editTitle")} backTo={`/instructor/assessments/${id}`} backLabel={t("assessments.backToAssessment")} />;

  if (loadError) {
    return (
      <>
        {header}
        <Alert tone="danger" title={t("assessments.loadOneFailedTitle")}>
          {loadError}
        </Alert>
      </>
    );
  }
  if (!assessment) return <PageSpinner />;

  const locked = assessment.is_executed || !["draft", "objectives_ready"].includes(assessment.status || "draft");

  return (
    <>
      {header}
      {locked && (
        <Alert
          tone="warning"
          title={t("assessments.lockedTitle")}
          className="mb-6"
          action={
            <Button to={`/instructor/assessments/${id}`} variant="secondary" icon={FaLock}>
              {t("assessments.backToAssessment")}
            </Button>
          }
        >
          {t("assessments.lockedBody")}
        </Alert>
      )}
      <AssessmentForm
        key={assessment.id}
        initialValues={formValuesFromAssessment(assessment)}
        submitLabel={t("assessments.saveChanges")}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/instructor/assessments/${id}`)}
        disabled={locked}
      />
    </>
  );
}

export default EditAssessment;
