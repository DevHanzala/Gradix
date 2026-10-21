import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import useAssessmentStore from "../../../store/assessmentStore.js";
import AssessmentForm from "../../../components/assessment/AssessmentForm.jsx";
import { formValuesFromAssessment } from "../../../components/assessment/assessmentFormValues.js";
import { PageHeader } from "../../../components/ui";

function CreateAssessment() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { createAssessment } = useAssessmentStore();

  const handleSubmit = async (formData) => {
    const created = await createAssessment(formData);
    toast.success(t("assessments.createdToast"));
    if (created?.skippedLinks?.length) toast.error(t("form.linksSkipped", { links: created.skippedLinks.map((l) => l.url).join(", ") }));
    // Next step after creating: review the learning objectives.
    navigate(created?.id ? `/instructor/assessments/${created.id}/objectives` : "/instructor/assessments");
  };

  return (
    <>
      <PageHeader
        title={t("nav.newAssessment")}
        description={t("assessments.createDescription")}
        backTo="/instructor/assessments"
        backLabel={t("assessments.all")}
      />
      <AssessmentForm
        initialValues={formValuesFromAssessment(null)}
        submitLabel={t("assessments.createButton")}
        onSubmit={handleSubmit}
        onCancel={() => navigate("/instructor/assessments")}
      />
    </>
  );
}

export default CreateAssessment;
