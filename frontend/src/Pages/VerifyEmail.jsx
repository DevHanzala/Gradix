import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import useAuthStore from "../store/authStore.js";
import AuthLayout from "../layouts/AuthLayout.jsx";
import { errorMessage } from "../utils/forms.js";
import { Button, Input, Alert, PageSpinner } from "../components/ui";

function ResendVerification() {
  const { t } = useTranslation();
  const resendVerification = useAuthStore((s) => s.resendVerification);
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [message, setMessage] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setState("error");
      setMessage(t("validation.emailInvalid"));
      return;
    }
    setState("sending");
    try {
      await resendVerification(email.trim());
      setState("sent");
      setMessage(t("auth.resendSent"));
    } catch (error) {
      setState("error");
      setMessage(errorMessage(error, t("auth.resendFailed")));
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
        label={t("auth.resendLabel")}
        type="email"
        dir="ltr"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={state === "error" ? message : undefined}
        placeholder={t("auth.emailPlaceholder")}
      />
      <Button type="submit" variant="secondary" fullWidth loading={state === "sending"}>
        {t("auth.resendButton")}
      </Button>
    </form>
  );
}

function VerifyEmail() {
  const { t } = useTranslation();
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
      setResult({ ok: false, message: t("auth.verifyIncomplete") });
      return;
    }

    verifyEmail(token)
      .then(() => setResult({ ok: true, message: t("auth.verifiedBody") }))
      .catch((error) => setResult({ ok: false, message: errorMessage(error, t("auth.verifyInvalid")) }));
  }, [token, verifyEmail, t]);

  return (
    <AuthLayout>
      <div className="text-center">
        {!result ? (
          <PageSpinner label={t("auth.verifying")} />
        ) : result.ok ? (
          <>
            <FaCheckCircle className="mx-auto text-5xl text-success-700" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-bold text-ink">{t("auth.verifiedTitle")}</h1>
            <p className="mt-2 text-ink-muted">{result.message}</p>
            <Button to="/login" fullWidth className="mt-6">
              {t("auth.login")}
            </Button>
          </>
        ) : (
          <>
            <FaTimesCircle className="mx-auto text-5xl text-danger-600" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-bold text-ink">{t("auth.linkNotValid")}</h1>
            <p className="mt-2 text-ink-muted">{result.message}</p>
            <p className="mt-2 text-sm text-ink-subtle">{t("auth.alreadyVerified")}</p>
            <ResendVerification />
            <Link to="/login" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary-700 hover:underline">
              {t("auth.backToLogin")}
            </Link>
          </>
        )}
      </div>
    </AuthLayout>
  );
}

export default VerifyEmail;
