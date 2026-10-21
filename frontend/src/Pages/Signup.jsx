import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import useAuthStore from "../store/authStore.js";
import { getCaptchaToken } from "../config/captcha.js";
import useRecaptchaInit from "../hooks/useRecaptchaInit.js";
import { signupSchema } from "../schemas/authSchemas.js";
import { redirectByRole } from "../utils/redirectByRole.js";
import { validateWith, errorMessage } from "../utils/forms.js";
import AuthLayout from "../layouts/AuthLayout.jsx";
import GoogleButton, { OrDivider } from "../components/GoogleButton.jsx";
import { Alert, Button, Input } from "../components/ui";

const EMPTY = { name: "", email: "", password: "" };

function Signup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signup, googleAuth } = useAuthStore();
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  useRecaptchaInit(siteKey);

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const onChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((errs) => ({ ...errs, [e.target.name]: undefined }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    const { errors: fieldErrors } = validateWith(signupSchema, form);
    if (fieldErrors) {
      setErrors(fieldErrors);
      return;
    }
    setLoading(true);
    try {
      const captchaToken = await getCaptchaToken(siteKey, "signup");
      await signup({ ...form, captchaToken });
      setSuccess(true);
      setForm(EMPTY);
    } catch (error) {
      setFormError(errorMessage(error, t("auth.signupFailed")));
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setFormError(null);
    setGoogleLoading(true);
    try {
      const user = await googleAuth();
      redirectByRole(user.role, navigate);
    } catch (error) {
      setFormError(errorMessage(error, t("auth.googleFailed")));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthLayout
      title={t("auth.signupTitle")}
      subtitle={t("auth.signupSubtitle")}
      showRecaptchaNotice
      footer={
        <>
          {t("auth.haveAccount")}{" "}
          <Link to="/login" className="inline-flex min-h-11 items-center font-semibold text-primary-700 hover:underline">
            {t("auth.login")}
          </Link>
        </>
      }
    >
      {success ? (
        <div className="space-y-4">
          <Alert tone="success" title={t("auth.checkInbox")}>
            {t("auth.signupSuccess")}
          </Alert>
          <Button to="/login" fullWidth>
            {t("auth.goToLogin")}
          </Button>
        </div>
      ) : (
        <>
          <GoogleButton loading={googleLoading} onClick={onGoogle}>
            {t("auth.signupWithGoogle")}
          </GoogleButton>
          <OrDivider />

          {formError && (
            <Alert tone="danger" className="mb-4">
              {formError}
            </Alert>
          )}

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <Input label={t("auth.fullName")} name="name" autoComplete="name" value={form.name} onChange={onChange} error={errors.name} required />
            <Input
              label={t("auth.email")}
              name="email"
              type="email"
              dir="ltr"
              autoComplete="email"
              value={form.email}
              onChange={onChange}
              error={errors.email}
              required
            />
            <Input
              label={t("auth.password")}
              name="password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={onChange}
              error={errors.password}
              hint={t("auth.passwordHint")}
              required
            />
            <Button type="submit" fullWidth loading={loading}>
              {t("auth.createAccount")}
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}

export default Signup;
