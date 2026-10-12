import nodemailer from "nodemailer";
import {
  verificationEmailTemplate,
  passwordResetEmailTemplate,
  passwordChangedEmailTemplate,
  roleChangeEmailTemplate,
  assessmentEnrollmentTemplate,
} from "../utils/emailTemplates.js";

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

export const sendVerificationEmail = (email, name, token) =>
  deliver(email, verificationEmailTemplate({ name, verificationUrl: appUrl(`/verify-email?token=${token}`) }));

export const sendPasswordResetEmail = (email, name, token) =>
  deliver(email, passwordResetEmailTemplate({ name, resetUrl: appUrl(`/reset-password/${token}`) }));

export const sendPasswordChangedEmail = (email, name) =>
  deliver(email, passwordChangedEmailTemplate({ name, changedAt: new Date().toISOString().replace("T", " ").slice(0, 16) }));

export const sendRoleChangeEmail = (email, name, oldRole, newRole) =>
  deliver(email, roleChangeEmailTemplate({ name, oldRole, newRole, dashboardUrl: appUrl("/login") }));

export const sendAssessmentEnrollmentEmail = (email, name, assessmentTitle, instructorName) =>
  deliver(
    email,
    assessmentEnrollmentTemplate({ name, assessmentTitle, instructorName, dashboardUrl: appUrl("/student/dashboard") })
  );
