import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import useAuthStore from "../store/authStore.js";
import { setNewPasswordSchema } from "../schemas/passwordSchemas.js";
import { validateWith, errorMessage } from "../utils/forms.js";
import AuthLayout from "../layouts/AuthLayout.jsx";
import { Alert, Button, Input } from "../components/ui";

const EMPTY = { newPassword: "", confirmPassword: "" };

/** Landing page of the emailed reset link: choose a new password. */
function SetNewPassword() {
  const { t } = useTranslation();
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
      setFormError(errorMessage(error, t("auth.resetLinkInvalid")));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title={t("auth.newPasswordTitle")} subtitle={t("auth.newPasswordSubtitle")}>
      {done ? (
        <div className="space-y-4">
          <Alert tone="success" title={t("auth.passwordUpdated")}>
            {t("auth.passwordUpdatedBody")}
          </Alert>
          <Button to="/login" fullWidth>
            {t("auth.goToLogin")}
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {formError && (
            <Alert
              tone="danger"
              action={
                <Link to="/forgot-password" className="font-semibold underline">
                  {t("auth.requestNewLink")}
                </Link>
              }
            >
              {formError}
            </Alert>
          )}
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
          <Button type="submit" fullWidth loading={loading}>
            {t("auth.updatePassword")}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

export default SetNewPassword;
