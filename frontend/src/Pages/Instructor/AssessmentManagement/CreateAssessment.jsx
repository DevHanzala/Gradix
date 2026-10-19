import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import useAssessmentStore from "../../../store/assessmentStore.js";
import AssessmentForm from "../../../components/assessment/AssessmentForm.jsx";
import { formValuesFromAssessment } from "../../../components/assessment/assessmentFormValues.js";
import { PageHeader } from "../../../components/ui";

function CreateAssessment() {
  const navigate = useNavigate();
  const { createAssessment } = useAssessmentStore();

  const handleSubmit = async (formData) => {
    const created = await createAssessment(formData);
    toast.success("Assessment created.");
    // Next step after creating: review the learning objectives.
    navigate(created?.id ? `/instructor/assessments/${created.id}/objectives` : "/instructor/assessments");
  };

  return (
    <>
      <PageHeader
        title="New assessment"
        description="Give it a title and something to generate questions from. Each student will get their own questions."
        backTo="/instructor/assessments"
        backLabel="All assessments"
      />
      <AssessmentForm
        initialValues={formValuesFromAssessment(null)}
        submitLabel="Create assessment"
        onSubmit={handleSubmit}
        onCancel={() => navigate("/instructor/assessments")}
      />
    </>
  );
}

export default CreateAssessment;
