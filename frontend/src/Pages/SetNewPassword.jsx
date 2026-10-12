import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import useAuthStore from "../store/authStore.js";
import { setNewPasswordSchema } from "../schemas/passwordSchemas.js";
import { validateWith, errorMessage } from "../utils/forms.js";
import AuthLayout from "../layouts/AuthLayout.jsx";
import { Alert, Button, Input } from "../components/ui";

const EMPTY = { newPassword: "", confirmPassword: "" };

/** Landing page of the emailed reset link: choose a new password. */
function SetNewPassword() {
  const { resetId } = useParams();
  const resetPassword = useAuthStore((state) => state.resetPassword);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const onChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((errs) => ({ ...errs, [e.target.name]: undefined }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    const { errors: fieldErrors } = validateWith(setNewPasswordSchema, form);
    if (fieldErrors) {
      setErrors(fieldErrors);
      return;
    }
    setLoading(true);
    try {
      await resetPassword({ newPassword: form.newPassword, resetId });
      setDone(true);
      setForm(EMPTY);
    } catch (error) {
      setFormError(errorMessage(error, "This reset link is invalid or has expired. Please request a new one."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Choose a new password" subtitle="Your new password will replace the old one immediately.">
      {done ? (
        <div className="space-y-4">
          <Alert tone="success" title="Password updated">
            You can now log in with your new password. We also sent you a confirmation email.
          </Alert>
          <Button to="/login" fullWidth>
            Go to login
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {formError && (
            <Alert
              tone="danger"
              action={
                <Link to="/forgot-password" className="font-semibold underline">
                  Request a new link
                </Link>
              }
            >
              {formError}
            </Alert>
          )}
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
          <Input
            label="Confirm new password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={onChange}
            error={errors.confirmPassword}
            required
          />
          <Button type="submit" fullWidth loading={loading}>
            Update password
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

export default SetNewPassword;
