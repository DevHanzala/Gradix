import { escapeHtml } from "./escapeHtml.js";

// Every interpolated value is escaped; URLs are built by the server but are
// escaped as attribute values too.

const layout = (body) => `<!DOCTYPE html>
<html>
<body style="font-family: Arial, Helvetica, sans-serif; color: #1f2937; line-height: 1.5;">
${body}
<p style="color: #6b7280; font-size: 12px;">Gradix</p>
</body>
</html>`;

const button = (url, label) =>
  `<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 18px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;">${escapeHtml(label)}</a></p>`;

export const verificationEmailTemplate = ({ name, verificationUrl }) => ({
  subject: "Verify your email - Gradix",
  html: layout(`
  <h2>Hi ${escapeHtml(name)},</h2>
  <p>Please verify your email address to activate your account.</p>
  ${button(verificationUrl, "Verify email")}
  <p>This link expires in 24 hours.</p>`),
});

export const passwordResetEmailTemplate = ({ name, resetUrl }) => ({
  subject: "Reset your password - Gradix",
  html: layout(`
  <h2>Hi ${escapeHtml(name)},</h2>
  <p>We received a request to reset your password.</p>
  ${button(resetUrl, "Reset password")}
  <p>This link expires in 1 hour. If you did not ask for this, you can ignore this email.</p>`),
});

export const passwordChangedEmailTemplate = ({ name, changedAt }) => ({
  subject: "Your password was changed - Gradix",
  html: layout(`
  <h2>Hi ${escapeHtml(name)},</h2>
  <p>The password for your Gradix account was changed on ${escapeHtml(changedAt)} (UTC).</p>
  <p>If this was not you, reset your password immediately and contact your administrator.</p>`),
});

export const roleChangeEmailTemplate = ({ name, oldRole, newRole, dashboardUrl }) => ({
  subject: "Your role has been updated - Gradix",
  html: layout(`
  <h2>Hi ${escapeHtml(name)},</h2>
  <p>Your role changed from <b>${escapeHtml(oldRole)}</b> to <b>${escapeHtml(newRole)}</b>.</p>
  ${button(dashboardUrl, "Open Gradix")}`),
});

export const assessmentEnrollmentTemplate = ({ name, assessmentTitle, instructorName, dashboardUrl }) => ({
  subject: `New assessment: ${assessmentTitle}`,
  html: layout(`
  <h2>Hi ${escapeHtml(name)},</h2>
  <p>You have been enrolled in <strong>${escapeHtml(assessmentTitle)}</strong>${
    instructorName ? ` by ${escapeHtml(instructorName)}` : ""
  }.</p>
  <p>Enrolled on ${escapeHtml(new Date().toUTCString())}.</p>
  ${button(dashboardUrl, "View assessment")}`),
});
