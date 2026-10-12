import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import useAuthStore from "../store/authStore.js";
import LoadingSpinner from "../components/ui/LoadingSpinner.jsx";

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
    return <p className="mt-6 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>;
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 space-y-3 text-start">
      <label htmlFor="resend-email" className="block text-sm font-semibold text-gray-800">
        Send a new verification link
      </label>
      <input
        id="resend-email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-invalid={state === "error"}
        aria-describedby={state === "error" ? "resend-error" : undefined}
        className="min-h-11 w-full rounded-lg border border-gray-300 px-3 text-base focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        placeholder="you@example.com"
      />
      {state === "error" && (
        <p id="resend-error" className="text-sm text-red-600">
          {message}
        </p>
      )}
      <button type="submit" className="btn-secondary w-full" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Resend verification email"}
      </button>
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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-200">
        {!result ? (
          <div role="status">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-gray-600">Verifying your email…</p>
          </div>
        ) : result.ok ? (
          <>
            <FaCheckCircle className="mx-auto text-5xl text-emerald-500" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-bold text-gray-900">Email verified</h1>
            <p className="mt-2 text-gray-600">{result.message}</p>
            <Link to="/login" className="btn-primary mt-6 w-full">
              Log in
            </Link>
          </>
        ) : (
          <>
            <FaTimesCircle className="mx-auto text-5xl text-red-500" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-bold text-gray-900">Link not valid</h1>
            <p className="mt-2 text-gray-600">{result.message}</p>
            <p className="mt-2 text-sm text-gray-500">If you already verified your email, you can simply log in.</p>
            <ResendVerification />
            <Link to="/login" className="mt-4 inline-block text-sm font-semibold text-indigo-700 hover:underline">
              Back to login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default VerifyEmail;
