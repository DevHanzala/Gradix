import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import useAuthStore from "../store/authStore.js";
import { changePasswordSchema } from "../schemas/passwordSchemas.js";
import { dashboardPathForRole } from "../utils/redirectByRole.js";
import { validateWith, errorMessage } from "../utils/forms.js";
import LanguageSwitcher from "../components/LanguageSwitcher.jsx";
import { Button, Card, CardBody, CardHeader, Input, PageHeader } from "../components/ui";

const EMPTY = { currentPassword: "", newPassword: "", confirmPassword: "" };

function ChangePasswordForm() {
  const { t } = useTranslation();
  const changePassword = useAuthStore((s) => s.changePassword);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const onChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((errs) => ({ ...errs, [e.target.name]: undefined }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const { errors: fieldErrors } = validateWith(changePasswordSchema, form);
    if (fieldErrors) {
      setErrors(fieldErrors);
      return;
    }
    setSaving(true);
    try {
      await changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast.success(t("profile.passwordChanged"));
      setForm(EMPTY);
    } catch (error) {
      if (error?.code === "INVALID_CURRENT_PASSWORD") setErrors({ currentPassword: errorMessage(error) });
      else toast.error(errorMessage(error, t("profile.passwordChangeFailed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Input
        label={t("profile.currentPassword")}
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        value={form.currentPassword}
        onChange={onChange}
        error={errors.currentPassword}
        required
      />
      <Input
        label={t("auth.newPassword")}
        name="newPassword"
        type="password"
        autoComplete="new-password"
        value={form.newPassword}
        onChange={onChange}
        error={errors.newPassword}
        hint={t("auth.passwordHint")}
        required
      />
      <Input
        label={t("auth.confirmNewPassword")}
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        value={form.confirmPassword}
        onChange={onChange}
        error={errors.confirmPassword}
        required
      />
      <Button type="submit" loading={saving} className="w-full sm:w-auto">
        {t("profile.changePassword")}
      </Button>
    </form>
  );
}

function Profile() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  if (!user) return null;

  const details = [
    { label: t("profile.name"), value: user.name },
    { label: t("auth.email"), value: user.email, dir: "ltr" },
    { label: t("profile.role"), value: t(`roles.${user.role}`) },
    { label: t("profile.signInMethod"), value: user.provider === "google" ? t("profile.methodGoogle") : t("profile.methodPassword") },
  ];

  return (
    <>
      <PageHeader
        title={t("nav.profile")}
        description={t("profile.description")}
        actions={
          <Button to={dashboardPathForRole(user.role)} variant="secondary">
            {t("profile.goToDashboard")}
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("profile.account")} />
          <CardBody>
            <dl className="space-y-4">
              {details.map((d) => (
                <div key={d.label}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{d.label}</dt>
                  <dd className="mt-0.5 break-words text-ink" dir={d.dir}>
                    {d.value}
                  </dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title={t("profile.languageTitle")} description={t("profile.languageDescription")} />
            <CardBody>
              <LanguageSwitcher />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("profile.changePassword")} />
            <CardBody>
              {user.provider === "google" ? <p className="text-ink-muted">{t("profile.googleNoPassword")}</p> : <ChangePasswordForm />}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

export default Profile;
