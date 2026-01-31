import nodemailer from "nodemailer";
import dotenv from "dotenv";
import {
  verificationEmailTemplate,
  passwordResetEmailTemplate,
  welcomeEmailTemplate,
  roleChangeEmailTemplate,
  assessmentEnrollmentTemplate,
  assessmentReminderTemplate,
} from "../utils/emailTemplates.js";

dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendEmail = async (to, subject, html) => {
  const result = await transporter.sendMail({
    from: `"Gradewise AI" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
    text: html.replace(/<[^>]*>/g, ""),
  });
  return { success: true, messageId: result.messageId };
};

export const sendVerificationEmail = async (email, name, token) => {
  const url = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  const { subject, html } = verificationEmailTemplate({ name, verificationUrl: url });

  sendEmail(email, subject, html).catch(console.error);
};

export const sendPasswordResetEmail = async (email, name, token) => {
  const url = `${process.env.FRONTEND_URL}/reset-password/${token}`;
  const { subject, html } = passwordResetEmailTemplate({ name, resetUrl: url });

  sendEmail(email, subject, html).catch(console.error);
};

export const sendWelcomeEmail = async (email, name, role) => {
  const url = `${process.env.FRONTEND_URL}/dashboard`;
  const { subject, html } = welcomeEmailTemplate({ name, role, dashboardUrl: url });

  return sendEmail(email, subject, html);
};

export const sendRoleChangeEmail = async (email, name, oldRole, newRole) => {
  const dashboardUrl = `${process.env.FRONTEND_URL}/dashboard`;
  const { subject, html } = roleChangeEmailTemplate({
    name,
    oldRole,
    newRole,
    dashboardUrl,
  });

  return sendEmail(email, subject, html);
};

export const sendAssessmentEnrollmentEmail = async (email, name, assessmentTitle, dueDate) => {
  const dashboardUrl = `${process.env.FRONTEND_URL}/student/dashboard`;
  const { subject, html } = assessmentEnrollmentTemplate({
    name,
    assessmentTitle,
    dueDate,
    dashboardUrl,
  });

  return sendEmail(email, subject, html);
};

export const sendAssessmentReminderEmail = async (
  email,
  name,
  assessmentTitle,
  dueDate,
  hoursRemaining
) => {
  const dashboardUrl = `${process.env.FRONTEND_URL}/dashboard`;
  const { subject, html } = assessmentReminderTemplate({
    name,
    assessmentTitle,
    dueDate,
    hoursRemaining,
    dashboardUrl,
  });

  return sendEmail(email, subject, html);
};

export const testEmailConfiguration = async () => {
  await transporter.verify();
  return { success: true, message: "Email configuration is valid" };
};
