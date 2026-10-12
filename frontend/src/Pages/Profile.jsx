import { useState } from "react";
import toast from "react-hot-toast";
import useAuthStore from "../store/authStore.js";
import { changePasswordSchema } from "../schemas/passwordSchemas.js";
import { dashboardPathForRole } from "../utils/redirectByRole.js";
import { ROLE_LABELS } from "../utils/rolePermissions.js";
import { validateWith, errorMessage } from "../utils/forms.js";
import { Button, Card, CardBody, CardHeader, Input, PageHeader } from "../components/ui";

const EMPTY = { currentPassword: "", newPassword: "", confirmPassword: "" };

function ChangePasswordForm() {
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
      toast.success("Password changed. We sent you a confirmation email.");
      setForm(EMPTY);
    } catch (error) {
      if (error?.code === "INVALID_CURRENT_PASSWORD") setErrors({ currentPassword: error.message });
      else toast.error(errorMessage(error, "Could not change your password."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Input label="Current password" name="currentPassword" type="password" autoComplete="current-password" value={form.currentPassword} onChange={onChange} error={errors.currentPassword} required />
      <Input
        label="New password"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        value={form.newPassword}
        onChange={onChange}
        error={errors.newPassword}
        hint="At least 8 characters with an uppercase letter, a lowercase letter and a number."
        required
      />
      <Input label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={onChange} error={errors.confirmPassword} required />
      <Button type="submit" loading={saving} className="w-full sm:w-auto">
        Change password
      </Button>
    </form>
  );
}

function Profile() {
  const { user } = useAuthStore();
  if (!user) return null;

  const details = [
    { label: "Name", value: user.name },
    { label: "Email", value: user.email },
    { label: "Role", value: ROLE_LABELS[user.role] || user.role },
    { label: "Sign-in method", value: user.provider === "google" ? "Google" : "Email and password" },
  ];

  return (
    <>
      <PageHeader
        title="My profile"
        description="Your account details and security settings."
        actions={
          <Button to={dashboardPathForRole(user.role)} variant="secondary">
            Go to dashboard
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Account" />
          <CardBody>
            <dl className="space-y-4">
              {details.map((d) => (
                <div key={d.label}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{d.label}</dt>
                  <dd className="mt-0.5 break-words text-ink">{d.value}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Change password" />
          <CardBody>
            {user.provider === "google" ? (
              <p className="text-ink-muted">You sign in with Google, so there is no Gradix password to change.</p>
            ) : (
              <ChangePasswordForm />
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

export default Profile;
