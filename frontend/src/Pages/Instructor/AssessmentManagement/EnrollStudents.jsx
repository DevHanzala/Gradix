import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { FaUserMinus, FaUsers } from "react-icons/fa";
import useAssessmentStore from "../../../store/assessmentStore.js";
import { enrollStudentSchema } from "../../../schemas/studentSchemas.js";
import { validateWith, errorMessage } from "../../../utils/forms.js";
import { RegisterStudentForm } from "../AddStudent.jsx";
import { Alert, Button, Card, CardBody, CardHeader, EmptyState, Input, Modal, PageHeader, ResponsiveTable, SkeletonList } from "../../../components/ui";

function EnrollByEmail({ assessmentId, onEnrolled }) {
  const enrollStudent = useAssessmentStore((s) => s.enrollStudent);
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    const { errors } = validateWith(enrollStudentSchema, { email });
    if (errors) {
      setError(errors.email);
      return;
    }
    setSaving(true);
    try {
      await enrollStudent(assessmentId, email.trim());
      toast.success(`${email.trim()} was enrolled and notified by email.`);
      setEmail("");
      onEnrolled();
    } catch (err) {
      setError(errorMessage(err, "Could not enroll this student."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Input
        label="Student email"
        type="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setError(null);
        }}
        error={error}
        hint="The student must already have a Gradix account."
        required
      />
      <Button type="submit" loading={saving} className="w-full sm:w-auto">
        Enroll student
      </Button>
    </form>
  );
}

function EnrollStudents() {
  const { assessmentId } = useParams();
  const { enrolledStudents, getEnrolledStudents, unenrollStudent } = useAssessmentStore();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [showRegister, setShowRegister] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      await getEnrolledStudents(assessmentId);
    } catch (error) {
      setLoadError(errorMessage(error, "Could not load enrolled students."));
    } finally {
      setLoading(false);
    }
  }, [assessmentId, getEnrolledStudents]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmRemove = async () => {
    try {
      await unenrollStudent(assessmentId, removeTarget.id);
      toast.success(`${removeTarget.name} was removed.`);
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "Could not remove the student."));
    }
  };

  const students = Array.isArray(enrolledStudents) ? enrolledStudents : [];

  return (
    <>
      <PageHeader
        title="Enroll students"
        description="Enrolled students see this assessment on their dashboard."
        backTo={`/instructor/assessments/${assessmentId}`}
        backLabel="Back to assessment"
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Add a student" />
            <CardBody>
              <EnrollByEmail assessmentId={assessmentId} onEnrolled={load} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title="Student has no account?"
              actions={
                <Button variant="secondary" onClick={() => setShowRegister((v) => !v)} aria-expanded={showRegister}>
                  {showRegister ? "Hide" : "Register student"}
                </Button>
              }
            />
            {showRegister && (
              <CardBody>
                <RegisterStudentForm />
              </CardBody>
            )}
          </Card>
        </div>

        <Card className="lg:col-span-3">
          <CardHeader title="Enrolled" description={loading ? undefined : `${students.length} student${students.length === 1 ? "" : "s"}`} />
          {loading ? (
            <SkeletonList rows={3} />
          ) : loadError ? (
            <div className="p-4 sm:p-6">
              <Alert tone="danger" action={<Button variant="secondary" onClick={load}>Try again</Button>}>
                {loadError}
              </Alert>
            </div>
          ) : students.length === 0 ? (
            <EmptyState icon={FaUsers} title="No students enrolled yet" description="Add students by email using the form." />
          ) : (
            <ResponsiveTable
              caption="Enrolled students"
              rows={students}
              columns={[
                { key: "name", header: "Name", primary: true },
                { key: "email", header: "Email" },
              ]}
              actions={(s) => (
                <Button variant="ghost" icon={FaUserMinus} className="text-danger-700 hover:bg-danger-50" onClick={() => setRemoveTarget(s)}>
                  Remove
                </Button>
              )}
            />
          )}
        </Card>
      </div>

      <Modal
        isOpen={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        type="warning"
        title={removeTarget ? `Remove ${removeTarget.name}?` : ""}
        onConfirm={confirmRemove}
        confirmText="Remove student"
        confirmVariant="danger"
      >
        The student will no longer see this assessment. Results of an attempt they already made are kept.
      </Modal>
    </>
  );
}

export default EnrollStudents;
