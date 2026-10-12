import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import useAuthStore from "../store/authStore.js";
import AuthLayout from "../layouts/AuthLayout.jsx";
import { Button, Input, Alert, PageSpinner } from "../components/ui";

function ResendVerification() {
  const resendVerification = useAuthStore((s) => s.resendVerification);
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [message, setMessage] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setState("error");
      setMessage("Please enter a valid email address.");
      return;
    }
    setState("sending");
    try {
      const response = await resendVerification(email.trim());
      setState("sent");
      setMessage(response.message);
    } catch (error) {
      setState("error");
      setMessage(error?.message || "Could not send the email. Please try again later.");
    }
  };

  if (state === "sent") {
    return (
      <Alert tone="success" className="mt-6 text-start">
        {message}
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 space-y-3 text-start">
      <Input
        label="Send a new verification link"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={state === "error" ? message : undefined}
        placeholder="you@example.com"
      />
      <Button type="submit" variant="secondary" fullWidth loading={state === "sending"}>
        Resend verification email
      </Button>
    </form>
  );
}

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const verifyEmail = useAuthStore((state) => state.verifyEmail);
  const [result, setResult] = useState(null); // { ok, message }
  const started = useRef(false);

  useEffect(() => {
    // Tokens are single-use; guard against React StrictMode running effects twice.
    if (started.current) return;
    started.current = true;

    if (!token) {
      setResult({ ok: false, message: "This verification link is incomplete." });
      return;
    }

    verifyEmail(token)
      .then((response) => setResult({ ok: true, message: response.message }))
      .catch((error) =>
        setResult({
          ok: false,
          message: error?.message || "This verification link is invalid or has expired.",
        })
      );
  }, [token, verifyEmail]);

  return (
    <AuthLayout>
      <div className="text-center">
        {!result ? (
          <PageSpinner label="Verifying your email…" />
        ) : result.ok ? (
          <>
            <FaCheckCircle className="mx-auto text-5xl text-success-600" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-bold text-ink">Email verified</h1>
            <p className="mt-2 text-ink-muted">{result.message}</p>
            <Button to="/login" fullWidth className="mt-6">
              Log in
            </Button>
          </>
        ) : (
          <>
            <FaTimesCircle className="mx-auto text-5xl text-danger-600" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-bold text-ink">Link not valid</h1>
            <p className="mt-2 text-ink-muted">{result.message}</p>
            <p className="mt-2 text-sm text-ink-subtle">If you already verified your email, you can simply log in.</p>
            <ResendVerification />
            <Link to="/login" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary-700 hover:underline">
              Back to login
            </Link>
          </>
        )}
      </div>
    </AuthLayout>
  );
}

export default VerifyEmail;
