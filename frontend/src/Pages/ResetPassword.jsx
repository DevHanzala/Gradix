import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import useAuthStore from "../store/authStore.js";
import { resetPasswordSchema } from "../schemas/passwordSchemas.js";
import { validateWith, errorMessage } from "../utils/forms.js";
import AuthLayout from "../layouts/AuthLayout.jsx";
import { Alert, Button, Input } from "../components/ui";

/** "Forgot password": request a reset link by email. */
function ResetPassword() {
  const { t } = useTranslation();
  const forgotPassword = useAuthStore((state) => state.forgotPassword);
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    const { errors } = validateWith(resetPasswordSchema, { email });
    if (errors) {
      setError(errors.email);
      return;
    }
    setLoading(true);
    try {
      await forgotPassword({ email: email.trim() });
      setSent(true);
    } catch (err) {
      setFormError(errorMessage(err, t("auth.resetSendFailed")));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={t("auth.resetTitle")}
      subtitle={t("auth.resetSubtitle")}
      footer={
        <Link to="/login" className="inline-flex min-h-11 items-center font-semibold text-primary-700 hover:underline">
          {t("auth.backToLogin")}
        </Link>
      }
    >
      {sent ? (
        <Alert tone="success" title={t("auth.checkInbox")}>
          {t("auth.resetSent")}
        </Alert>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Input
            label={t("auth.email")}
            name="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            error={error}
            required
          />
          <Button type="submit" fullWidth loading={loading}>
            {t("auth.sendResetLink")}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

export default ResetPassword;
