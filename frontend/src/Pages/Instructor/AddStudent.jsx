import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import useAuthStore from "../../store/authStore.js";
import { registerStudentSchema } from "../../schemas/studentSchemas.js";
import { validateWith, errorMessage } from "../../utils/forms.js";
import { LANGUAGES } from "../../utils/languages.js";
import { Alert, Button, Card, CardBody, CardHeader, Input, PageHeader, Select } from "../../components/ui";

const EMPTY = { name: "", email: "", password: "", confirmPassword: "" };

/** Create a student account (the student receives a verification email in their language). */
export function RegisterStudentForm({ onRegistered }) {
  const { t, i18n } = useTranslation();
  const registerStudent = useAuthStore((s) => s.registerStudent);
  const [form, setForm] = useState(EMPTY);
  const [language, setLanguage] = useState(i18n.language);
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
      await registerStudent({ name: form.name.trim(), email: form.email.trim(), password: form.password, language });
      toast.success(t("students.created", { name: form.name.trim() }));
      onRegistered?.(form.email.trim());
      setForm(EMPTY);
    } catch (error) {
      setFormError(errorMessage(error, t("students.createFailed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError && <Alert tone="danger">{formError}</Alert>}
      <Input label={t("auth.fullName")} name="name" autoComplete="off" value={form.name} onChange={onChange} error={errors.name} required />
      <Input
        label={t("auth.email")}
        name="email"
        type="email"
        dir="ltr"
        autoComplete="off"
        value={form.email}
        onChange={onChange}
        error={errors.email}
        required
      />
      <Select
        label={t("students.language")}
        hint={t("students.languageHint")}
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        options={LANGUAGES.map((l) => ({ value: l.code, label: l.name }))}
      />
      <Input
        label={t("students.tempPassword")}
        name="password"
        type="password"
        autoComplete="new-password"
        value={form.password}
        onChange={onChange}
        error={errors.password}
        hint={t("students.tempPasswordHint")}
        required
      />
      <Input
        label={t("students.confirmPassword")}
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        value={form.confirmPassword}
        onChange={onChange}
        error={errors.confirmPassword}
        required
      />
      <Button type="submit" loading={saving} className="w-full sm:w-auto">
        {t("students.createButton")}
      </Button>
    </form>
  );
}

function AddStudent() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t("students.registerTitle")} description={t("students.registerDescription")} />
      <Card>
        <CardHeader title={t("students.newAccount")} />
        <CardBody>
          <RegisterStudentForm />
        </CardBody>
      </Card>
    </>
  );
}

export default AddStudent;
