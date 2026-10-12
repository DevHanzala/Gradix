import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import useAuthStore from "../store/authStore.js";
import { changePasswordSchema } from "../schemas/passwordSchemas.js";
import { dashboardPathForRole } from "../utils/redirectByRole.js";
import { ROLE_LABELS } from "../utils/rolePermissions.js";

const EMPTY = { currentPassword: "", newPassword: "", confirmPassword: "" };

function PasswordField({ id, label, value, error, onChange, autoComplete }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-gray-800">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="password"
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`min-h-11 w-full rounded-lg border px-3 text-base focus:outline-none focus:ring-2 ${
          error ? "border-red-400 focus:ring-red-200" : "border-gray-300 focus:border-indigo-600 focus:ring-indigo-200"
        }`}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

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
    const parsed = changePasswordSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors = {};
      for (const issue of parsed.error.issues) fieldErrors[issue.path[0]] ??= issue.message;
      setErrors(fieldErrors);
      return;
    }

    setSaving(true);
    try {
      await changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast.success("Password changed. We sent a confirmation email.");
      setForm(EMPTY);
    } catch (error) {
      if (error?.code === "INVALID_CURRENT_PASSWORD") {
        setErrors({ currentPassword: error.message });
      } else {
        toast.error(error?.message || "Could not change your password.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <PasswordField id="currentPassword" label="Current password" value={form.currentPassword} error={errors.currentPassword} onChange={onChange} autoComplete="current-password" />
      <PasswordField id="newPassword" label="New password" value={form.newPassword} error={errors.newPassword} onChange={onChange} autoComplete="new-password" />
      <PasswordField id="confirmPassword" label="Confirm new password" value={form.confirmPassword} error={errors.confirmPassword} onChange={onChange} autoComplete="new-password" />
      <p className="text-xs text-gray-500">At least 8 characters with an uppercase letter, a lowercase letter and a number.</p>
      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving}>
        {saving ? "Saving…" : "Change password"}
      </button>
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
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">My profile</h1>
          <p className="mt-1 text-gray-600">Your account details and security settings.</p>
        </div>
        <Link to={dashboardPathForRole(user.role)} className="btn-secondary">
          Go to dashboard
        </Link>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200" aria-labelledby="account-heading">
          <h2 id="account-heading" className="text-lg font-semibold text-gray-900">
            Account
          </h2>
          <dl className="mt-4 space-y-3">
            {details.map((d) => (
              <div key={d.label}>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{d.label}</dt>
                <dd className="break-words text-gray-900">{d.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200" aria-labelledby="password-heading">
          <h2 id="password-heading" className="text-lg font-semibold text-gray-900">
            Change password
          </h2>
          <div className="mt-4">
            {user.provider === "google" ? (
              <p className="text-gray-600">You sign in with Google, so there is no Gradix password to change.</p>
            ) : (
              <ChangePasswordForm />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default Profile;
