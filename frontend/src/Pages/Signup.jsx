import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  const { signup, googleAuth } = useAuthStore();
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  useRecaptchaInit(siteKey);

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [success, setSuccess] = useState(null);
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
      const response = await signup({ ...form, captchaToken });
      setSuccess(response.message || "Account created. Check your email to verify your account.");
      setForm(EMPTY);
    } catch (error) {
      setFormError(errorMessage(error, "Registration failed. Please try again."));
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
      setFormError(errorMessage(error, "Google sign-up failed. Please try again."));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="New accounts start as students. An admin can change your role."
      showRecaptchaNotice
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="inline-flex min-h-11 items-center font-semibold text-primary-700 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      {success ? (
        <div className="space-y-4">
          <Alert tone="success" title="Check your inbox">
            {success}
          </Alert>
          <Button to="/login" fullWidth>
            Go to login
          </Button>
        </div>
      ) : (
        <>
          <GoogleButton loading={googleLoading} onClick={onGoogle}>
            Sign up with Google
          </GoogleButton>
          <OrDivider />

          {formError && (
            <Alert tone="danger" className="mb-4">
              {formError}
            </Alert>
          )}

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <Input label="Full name" name="name" autoComplete="name" value={form.name} onChange={onChange} error={errors.name} required />
            <Input label="Email" name="email" type="email" autoComplete="email" value={form.email} onChange={onChange} error={errors.email} required />
            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={onChange}
              error={errors.password}
              hint="At least 8 characters with an uppercase letter, a lowercase letter and a number."
              required
            />
            <Button type="submit" fullWidth loading={loading}>
              Create account
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}

export default Signup;
