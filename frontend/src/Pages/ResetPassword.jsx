import { useState } from "react";
import { Link } from "react-router-dom";
import useAuthStore from "../store/authStore.js";
import { resetPasswordSchema } from "../schemas/passwordSchemas.js";
import { validateWith, errorMessage } from "../utils/forms.js";
import AuthLayout from "../layouts/AuthLayout.jsx";
import { Alert, Button, Input } from "../components/ui";

/** "Forgot password": request a reset link by email. */
function ResetPassword() {
  const forgotPassword = useAuthStore((state) => state.forgotPassword);
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [sentMessage, setSentMessage] = useState(null);
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
      const response = await forgotPassword({ email: email.trim() });
      setSentMessage(response?.message || "If an account with that email exists, we have sent a reset link.");
    } catch (err) {
      setFormError(errorMessage(err, "Could not send the reset link. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your account email and we will send you a reset link."
      footer={
        <Link to="/login" className="font-semibold text-primary-700 hover:underline">
          Back to login
        </Link>
      }
    >
      {sentMessage ? (
        <Alert tone="success" title="Check your inbox">
          {sentMessage} The link expires in 1 hour. Check your spam folder if you do not see it.
        </Alert>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Input
            label="Email"
            name="email"
            type="email"
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
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

export default ResetPassword;
