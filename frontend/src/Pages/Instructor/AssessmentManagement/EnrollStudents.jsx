import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { FaUserMinus, FaUsers } from "react-icons/fa";
import useAssessmentStore from "../../../store/assessmentStore.js";
import { enrollStudentSchema } from "../../../schemas/studentSchemas.js";
import { validateWith, errorMessage } from "../../../utils/forms.js";
import { formatNumber } from "../../../utils/format.js";
import { RegisterStudentForm } from "../AddStudent.jsx";
import { Alert, Button, Card, CardBody, CardHeader, EmptyState, Input, Modal, PageHeader, ResponsiveTable, SkeletonList } from "../../../components/ui";

function EnrollByEmail({ assessmentId, onEnrolled }) {
  const { t } = useTranslation();
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
      toast.success(t("enroll.enrolled", { email: email.trim() }));
      setEmail("");
      onEnrolled();
    } catch (err) {
      setError(errorMessage(err, t("enroll.enrollFailed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Input
        label={t("enroll.studentEmail")}
        type="email"
        dir="ltr"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setError(null);
        }}
        error={error}
        hint={t("enroll.emailHint")}
        required
      />
      <Button type="submit" loading={saving} className="w-full sm:w-auto">
        {t("enroll.enrollButton")}
      </Button>
    </form>
  );
}

function EnrollStudents() {
  const { t } = useTranslation();
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
      setLoadError(errorMessage(error, t("enroll.loadFailed")));
    } finally {
      setLoading(false);
    }
  }, [assessmentId, getEnrolledStudents, t]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmRemove = async () => {
    try {
      await unenrollStudent(assessmentId, removeTarget.id);
      toast.success(t("enroll.removed", { name: removeTarget.name }));
      await load();
    } catch (error) {
      toast.error(errorMessage(error, t("enroll.removeFailed")));
    }
  };

  const students = Array.isArray(enrolledStudents) ? enrolledStudents : [];

  return (
    <>
      <PageHeader
        title={t("enroll.title")}
        description={t("enroll.description")}
        backTo={`/instructor/assessments/${assessmentId}`}
        backLabel={t("assessments.backToAssessment")}
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title={t("enroll.addStudent")} />
            <CardBody>
              <EnrollByEmail assessmentId={assessmentId} onEnrolled={load} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title={t("enroll.noAccount")}
              actions={
                <Button variant="secondary" onClick={() => setShowRegister((v) => !v)} aria-expanded={showRegister}>
                  {showRegister ? t("common.hide") : t("nav.registerStudent")}
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
          <CardHeader title={t("enroll.enrolledTitle")} description={loading ? undefined : t("enroll.count", { count: formatNumber(students.length) })} />
          {loading ? (
            <SkeletonList rows={3} />
          ) : loadError ? (
            <div className="p-4 sm:p-6">
              <Alert
                tone="danger"
                action={
                  <Button variant="secondary" onClick={load}>
                    {t("common.tryAgain")}
                  </Button>
                }
              >
                {loadError}
              </Alert>
            </div>
          ) : students.length === 0 ? (
            <EmptyState icon={FaUsers} title={t("enroll.none")} description={t("enroll.noneDescription")} />
          ) : (
            <ResponsiveTable
              caption={t("enroll.enrolledTitle")}
              rows={students}
              columns={[
                { key: "name", header: t("profile.name"), primary: true },
                { key: "email", header: t("auth.email"), render: (s) => <span dir="ltr">{s.email}</span> },
              ]}
              actions={(s) => (
                <Button variant="ghost" icon={FaUserMinus} className="text-danger-700 hover:bg-danger-50" onClick={() => setRemoveTarget(s)}>
                  {t("common.remove")}
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
        title={removeTarget ? t("enroll.removeTitle", { name: removeTarget.name }) : ""}
        onConfirm={confirmRemove}
        confirmText={t("enroll.removeConfirm")}
        confirmVariant="danger"
      >
        {t("enroll.removeBody")}
      </Modal>
    </>
  );
}

export default EnrollStudents;
