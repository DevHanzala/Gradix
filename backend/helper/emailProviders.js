/**
 * Email delivery providers, chosen by EMAIL_PROVIDER:
 *  - brevo:  Brevo HTTP API (production default; Render's free tier blocks SMTP ports).
 *            Works with one verified sender address, no domain needed.
 *  - resend: Resend HTTP API (needs a verified domain for real recipients).
 *  - smtp:   Gmail SMTP with an app password (local development).
 * Without EMAIL_PROVIDER the first configured one wins: BREVO_API_KEY, RESEND_API_KEY, then EMAIL_USER/EMAIL_PASS.
 *
 * Sender: EMAIL_FROM (address) and EMAIL_FROM_NAME (default "Gradix"); for smtp EMAIL_FROM defaults to EMAIL_USER.
 */
const TIMEOUT_MS = 10000;
export const EMAIL_PROVIDERS = ["brevo", "resend", "smtp"];

const value = (env, name) => (env[name] && String(env[name]).trim()) || "";

export const resolveEmailProvider = (env = process.env) => {
  const chosen = value(env, "EMAIL_PROVIDER").toLowerCase();
  if (chosen) return chosen;
  if (value(env, "BREVO_API_KEY")) return "brevo";
  if (value(env, "RESEND_API_KEY")) return "resend";
  if (value(env, "EMAIL_USER") && value(env, "EMAIL_PASS")) return "smtp";
  return null;
};

/** Variables the chosen provider needs (startup check). */
export const missingEmailSettings = (env = process.env) => {
  const provider = resolveEmailProvider(env);
  if (!provider) return ["an email provider (EMAIL_PROVIDER with BREVO_API_KEY, RESEND_API_KEY or EMAIL_USER/EMAIL_PASS)"];
  if (!EMAIL_PROVIDERS.includes(provider)) return [`EMAIL_PROVIDER must be one of ${EMAIL_PROVIDERS.join(", ")}`];
  const needed = {
    brevo: ["BREVO_API_KEY", "EMAIL_FROM"],
    resend: ["RESEND_API_KEY", "EMAIL_FROM"],
    smtp: ["EMAIL_USER", "EMAIL_PASS"],
  }[provider];
  return needed.filter((name) => !value(env, name));
};

const sender = (env) => ({
  name: value(env, "EMAIL_FROM_NAME") || "Gradix",
  email: value(env, "EMAIL_FROM") || value(env, "EMAIL_USER"),
});

/** Network calls behind an adapter so tests can replace them. */
export const httpClient = {
  post: async (url, { headers, body }) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
    }
    return response.json().catch(() => ({}));
  },
};

const brevo = async (message, env) => {
  const from = sender(env);
  const result = await httpClient.post("https://api.brevo.com/v3/smtp/email", {
    headers: { "api-key": value(env, "BREVO_API_KEY") },
    body: {
      sender: { name: from.name, email: from.email },
      to: [{ email: message.to }],
      subject: message.subject,
      htmlContent: message.html,
      textContent: message.text,
    },
  });
  return { provider: "brevo", id: result?.messageId || null };
};

const resend = async (message, env) => {
  const from = sender(env);
  const result = await httpClient.post("https://api.resend.com/emails", {
    headers: { authorization: `Bearer ${value(env, "RESEND_API_KEY")}` },
    body: { from: `${from.name} <${from.email}>`, to: [message.to], subject: message.subject, html: message.html, text: message.text },
  });
  return { provider: "resend", id: result?.id || null };
};

let transporter = null;
const smtp = async (message, env) => {
  if (!transporter) {
    // Loaded only when SMTP is used (keeps it out of memory on Render).
    const { default: nodemailer } = await import("nodemailer");
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: value(env, "EMAIL_USER"), pass: value(env, "EMAIL_PASS") },
    });
  }
  const from = sender(env);
  const info = await transporter.sendMail({ from: `"${from.name}" <${from.email}>`, ...message });
  return { provider: "smtp", id: info?.messageId || null };
};

const SENDERS = { brevo, resend, smtp };

/** Send one message ({ to, subject, html, text }) through the configured provider. */
export const sendWithProvider = async (message, env = process.env) => {
  const provider = resolveEmailProvider(env);
  const send = SENDERS[provider];
  if (!send) throw new Error(`No email provider configured (${provider || "none"})`);
  return send(message, env);
};
