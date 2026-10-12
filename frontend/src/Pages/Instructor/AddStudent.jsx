import { useState } from "react";
import toast from "react-hot-toast";
import useAuthStore from "../../store/authStore.js";
import { registerStudentSchema } from "../../schemas/studentSchemas.js";
import { validateWith, errorMessage } from "../../utils/forms.js";
import { Alert, Button, Card, CardBody, CardHeader, Input, PageHeader } from "../../components/ui";

const EMPTY = { name: "", email: "", password: "", confirmPassword: "" };

/** Create a student account (the student receives a verification email). */
export function RegisterStudentForm({ onRegistered }) {
  const registerStudent = useAuthStore((s) => s.registerStudent);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const onChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((errs) => ({ ...errs, [e.target.name]: undefined }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    const { errors: fieldErrors } = validateWith(registerStudentSchema, form);
    if (fieldErrors) {
      setErrors(fieldErrors);
      return;
    }
    setSaving(true);
    try {
      await registerStudent({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      toast.success(`Account created for ${form.name.trim()}. A verification email was sent.`);
      onRegistered?.(form.email.trim());
      setForm(EMPTY);
    } catch (error) {
      setFormError(errorMessage(error, "Could not create the account."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError && <Alert tone="danger">{formError}</Alert>}
      <Input label="Full name" name="name" autoComplete="off" value={form.name} onChange={onChange} error={errors.name} required />
      <Input label="Email" name="email" type="email" autoComplete="off" value={form.email} onChange={onChange} error={errors.email} required />
      <Input
        label="Temporary password"
        name="password"
        type="password"
        autoComplete="new-password"
        value={form.password}
        onChange={onChange}
        error={errors.password}
        hint="8+ characters with upper and lower case letters and a number. Share it securely; the student can change it later."
        required
      />
      <Input
        label="Confirm password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        value={form.confirmPassword}
        onChange={onChange}
        error={errors.confirmPassword}
        required
      />
      <Button type="submit" loading={saving} className="w-full sm:w-auto">
        Create student account
      </Button>
    </form>
  );
}

function AddStudent() {
  return (
    <>
      <PageHeader
        title="Register a student"
        description="Create an account for a student who has not signed up yet. Enroll them from an assessment afterwards."
      />
      <Card className="max-w-2xl">
        <CardHeader title="New student account" />
        <CardBody>
          <RegisterStudentForm />
        </CardBody>
      </Card>
    </>
  );
}

export default AddStudent;
