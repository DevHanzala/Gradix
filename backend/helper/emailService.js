import nodemailer from "nodemailer";
import {
  verificationEmailTemplate,
  passwordResetEmailTemplate,
  passwordChangedEmailTemplate,
  roleChangeEmailTemplate,
  assessmentEnrollmentTemplate,
  accountDeletedEmailTemplate,
  assessmentPublishedTemplate,
  resultsReadyTemplate,
} from "../utils/emailTemplates.js";
import { formatDateTime, normalizeLanguage } from "./i18n.js";

let transporter = null;
const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  }
  return transporter;
};

/**
 * Indirection so tests can capture emails instead of sending them.
 */
export const mailer = {
  send: async ({ to, subject, html }) =>
    getTransporter().sendMail({
      from: `"Gradix" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text: html.replace(/<[^>]*>/g, ""),
    }),
};

/**
 * Fire-and-forget delivery. Call ONLY after the related DB change has been
 * committed. A failed email is logged and never fails the request.
 */
const deliver = (to, { subject, html }) => {
  Promise.resolve()
    .then(() => mailer.send({ to, subject, html }))
    .catch((error) => {
      console.error(`[email] "${subject}" to ${to} failed: ${error.message}`);
    });
};

const appUrl = (path) => `${process.env.FRONTEND_URL || ""}${path}`;

/**
 * Senders take the recipient { email, name, language } so every email is
 * written in the recipient's own language (users.language_preference).
 */
const lang = (recipient) => normalizeLanguage(recipient?.language || recipient?.language_preference);

export const sendVerificationEmail = (recipient, token) =>
  deliver(
    recipient.email,
    verificationEmailTemplate({ lang: lang(recipient), name: recipient.name, verificationUrl: appUrl(`/verify-email?token=${token}`) })
  );

export const sendPasswordResetEmail = (recipient, token) =>
  deliver(recipient.email, passwordResetEmailTemplate({ lang: lang(recipient), name: recipient.name, resetUrl: appUrl(`/reset-password/${token}`) }));

export const sendPasswordChangedEmail = (recipient) =>
  deliver(
    recipient.email,
    passwordChangedEmailTemplate({ lang: lang(recipient), name: recipient.name, changedAt: formatDateTime(lang(recipient)) })
  );

export const sendRoleChangeEmail = (recipient, oldRole, newRole) =>
  deliver(recipient.email, roleChangeEmailTemplate({ lang: lang(recipient), name: recipient.name, oldRole, newRole, dashboardUrl: appUrl("/login") }));

export const sendAssessmentEnrollmentEmail = (recipient, assessmentTitle, instructorName) =>
  deliver(
    recipient.email,
    assessmentEnrollmentTemplate({
      lang: lang(recipient),
      name: recipient.name,
      assessmentTitle,
      instructorName,
      enrolledAt: formatDateTime(lang(recipient)),
      dashboardUrl: appUrl("/student/dashboard"),
    })
  );

export const sendAccountDeletedEmail = (recipient) =>
  deliver(recipient.email, accountDeletedEmailTemplate({ lang: lang(recipient), name: recipient.name }));

export const sendAssessmentPublishedEmail = (recipient, assessmentTitle) =>
  deliver(
    recipient.email,
    assessmentPublishedTemplate({ lang: lang(recipient), name: recipient.name, assessmentTitle, dashboardUrl: appUrl("/student/dashboard") })
  );

export const sendResultsReadyEmail = (recipient, assessmentTitle, percentage, assessmentId) =>
  deliver(
    recipient.email,
    resultsReadyTemplate({
      lang: lang(recipient),
      name: recipient.name,
      assessmentTitle,
      percentage,
      resultsUrl: appUrl(`/student/results/${assessmentId}`),
    })
  );
