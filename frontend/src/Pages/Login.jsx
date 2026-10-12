import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore.js";
import { getCaptchaToken } from "../config/captcha.js";
import useRecaptchaInit from "../hooks/useRecaptchaInit.js";
import { loginSchema } from "../schemas/authSchemas.js";
import { redirectByRole } from "../utils/redirectByRole.js";
import { validateWith, errorMessage } from "../utils/forms.js";
import AuthLayout from "../layouts/AuthLayout.jsx";
import GoogleButton, { OrDivider } from "../components/GoogleButton.jsx";
import { Alert, Button, Input } from "../components/ui";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, googleAuth } = useAuthStore();
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  useRecaptchaInit(siteKey);

  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const goToApp = (user) => {
    const from = location.state?.from;
    if (from && from !== "/login") navigate(from, { replace: true });
    else redirectByRole(user.role, navigate);
  };

  const onChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((errs) => ({ ...errs, [e.target.name]: undefined }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    const { errors: fieldErrors } = validateWith(loginSchema, form);
    if (fieldErrors) {
      setErrors(fieldErrors);
      return;
    }
    setLoading(true);
    try {
      const captchaToken = await getCaptchaToken(siteKey, "login");
      const user = await login({ ...form, captchaToken });
      goToApp(user);
    } catch (error) {
      setFormError(errorMessage(error, "Login failed. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setFormError(null);
    setGoogleLoading(true);
    try {
      goToApp(await googleAuth());
    } catch (error) {
      setFormError(errorMessage(error, "Google sign-in failed. Please try again."));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Log in"
      subtitle="Welcome back to Gradix."
      showRecaptchaNotice
      footer={
        <>
          New to Gradix?{" "}
          <Link to="/signup" className="inline-flex min-h-11 items-center font-semibold text-primary-700 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <GoogleButton loading={googleLoading} onClick={onGoogle} />
      <OrDivider />

      {formError && (
        <Alert tone="danger" className="mb-4">
          {formError}
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Input label="Email" name="email" type="email" autoComplete="email" value={form.email} onChange={onChange} error={errors.email} required />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={onChange}
          error={errors.password}
          required
        />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-700 hover:underline">
            Forgot your password?
          </Link>
        </div>
        <Button type="submit" fullWidth loading={loading}>
          Log in
        </Button>
      </form>
    </AuthLayout>
  );
}

export default Login;
