import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { FaLock } from "react-icons/fa";
import useAssessmentStore from "../../../store/assessmentStore.js";
import AssessmentForm from "../../../components/assessment/AssessmentForm.jsx";
import { formValuesFromAssessment } from "../../../components/assessment/assessmentFormValues.js";
import { Alert, Button, PageHeader, PageSpinner } from "../../../components/ui";
import { errorMessage } from "../../../utils/forms.js";

function EditAssessment() {
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
      .catch((error) => active && setLoadError(errorMessage(error, "Could not load this assessment.")));
    return () => {
      active = false;
    };
  }, [id, getAssessmentById]);

  const handleSubmit = async (formData) => {
    await updateAssessment(Number(id), formData);
    toast.success("Assessment updated.");
    navigate(`/instructor/assessments/${id}`);
  };

  const header = (
    <PageHeader title="Edit assessment" backTo={`/instructor/assessments/${id}`} backLabel="Back to assessment" />
  );

  if (loadError) {
    return (
      <>
        {header}
        <Alert tone="danger" title="Could not load the assessment">
          {loadError}
        </Alert>
      </>
    );
  }
  if (!assessment) return <PageSpinner />;

  return (
    <>
      {header}
      {assessment.is_executed && (
        <Alert
          tone="warning"
          title="This assessment is locked"
          className="mb-6"
          action={<Button to={`/instructor/assessments/${id}`} variant="secondary" icon={FaLock}>Back to assessment</Button>}
        >
          Students have already started it, so its settings can no longer be changed. You can still enroll students and print papers.
        </Alert>
      )}
      <AssessmentForm
        key={assessment.id}
        initialValues={formValuesFromAssessment(assessment)}
        submitLabel="Save changes"
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/instructor/assessments/${id}`)}
        disabled={assessment.is_executed}
      />
    </>
  );
}

export default EditAssessment;
