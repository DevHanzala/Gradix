import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Create transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send email with template support
 */
export const sendEmail = async (to, subject, htmlContent, textContent = null) => {
  try {
    const mailOptions = {
      from: `"Gradewise AI" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: htmlContent,
      text: textContent || htmlContent.replace(/<[^>]*>/g, ""), // Strip HTML for text version
    };

    const result = await transporter.sendMail(mailOptions);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

/**
 * Send verification email
 */
export const sendVerificationEmail = async (email, name, verificationToken) => {
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;

  const subject = "Verify Your Email - Gradwise AI";
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verification</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4f46e5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Gradwise AI!</h1>
        </div>
        <div class="content">
          <h2>Hi ${name},</h2>
          <p>Thank you for signing up for Gradwise AI! To complete your registration, please verify your email address by clicking the button below:</p>
          
          <div style="text-align: center;">
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
          </div>
          
          <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #4f46e5;">${verificationUrl}</p>
          
          <p><strong>This verification link will expire in 24 hours.</strong></p>
          
          <p>If you didn't create an account with Gradwise AI, you can safely ignore this email.</p>
          
          <p>Best regards,<br>The Gradwise AI Team</p>
        </div>
        <div class="footer">
          <p>© 2025 Gradwise AI. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Fire and forget — no await to prevent hanging
  sendEmail(email, subject, htmlContent).catch((error) => {
    console.error(`Background verification email failed for ${email}:`, error.message);
  });

  console.log(`Verification email triggered for ${email} (sent in background)`);
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (email, name, resetToken) => {
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const resetUrl = `${baseUrl}/reset-password/${resetToken}`;

  const subject = "Reset Your Password - Gradwise AI";
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <h2>Hi ${name},</h2>
          <p>We received a request to reset your password for your Gradwise AI account. Click the button below to set a new password:</p>
          
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Set New Password</a>
          </div>
          
          <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #dc2626;">${resetUrl}</p>
          
          <div class="warning">
            <p><strong>⚠️ Important Security Information:</strong></p>
            <ul>
              <li>This reset link will expire in 1 hour</li>
              <li>If you didn't request this reset, please ignore this email</li>
              <li>Your password will remain unchanged until you create a new one</li>
            </ul>
          </div>
          
          <p>For security reasons, we recommend choosing a strong password that includes:</p>
          <ul>
            <li>At least 8 characters</li>
            <li>A mix of uppercase and lowercase letters</li>
            <li>Numbers and special characters</li>
          </ul>
          
          <p>If you need further assistance, contact support@gradwise.ai.</p>
          
          <p>Best regards,<br>The Gradwise AI Team</p>
        </div>
        <div class="footer">
          <p>© 2025 Gradwise AI. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Fire and forget — no await to prevent hanging
  sendEmail(email, subject, htmlContent).catch((error) => {
    console.error(`Background reset email failed for ${email}:`, error.message);
  });

  console.log(`Reset email triggered for ${email} (sent in background)`);
};

/**
 * Send welcome email after verification
 */
export const sendWelcomeEmail = async (email, name, role) => {
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const dashboardUrl = `${baseUrl}/dashboard`;

  const subject = "Welcome to Gradewise AI - Let's Get Started!";
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Gradewise AI</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        .feature-list { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Welcome to Gradewise AI!</h1>
        </div>
        <div class="content">
          <h2>Hi ${name},</h2>
          <p>Congratulations! Your email has been verified and your account is now active. Welcome to the future of AI-powered education!</p>
          
          <div style="text-align: center;">
            <a href="${dashboardUrl}" class="button">Go to Dashboard</a>
          </div>
          
          <div class="feature-list">
            <h3>🚀 What you can do as a ${role}:</h3>
            ${
              role === "instructor"
                ? `
              <ul>
                <li>Create and manage assessments</li>
                <li>Generate AI-powered questions</li>
                <li>Enroll students and track progress</li>
                <li>Get detailed analytics and insights</li>
                <li>Provide personalized feedback</li>
              </ul>
            `
                : role === "student"
                  ? `
              <ul>
                <li>Access your assigned assessments</li>
                <li>Take AI-generated tests</li>
                <li>Track your progress</li>
                <li>Receive personalized feedback</li>
                <li>View detailed performance analytics</li>
              </ul>
            `
                  : `
              <ul>
                <li>Manage all users and assessments</li>
                <li>Access platform analytics</li>
                <li>Configure system settings</li>
                <li>Monitor platform performance</li>
              </ul>
            `
            }
          </div>
          
          <p><strong>Need help getting started?</strong></p>
          <ul>
            <li>Check out our <a href="${process.env.FRONTEND_URL}/help">Help Center</a></li>
            <li>Watch our <a href="${process.env.FRONTEND_URL}/tutorials">Video Tutorials</a></li>
            <li>Contact our support team at support@gradewise.ai</li>
          </ul>
          
          <p>We're excited to have you on board and can't wait to see what you'll achieve with Gradewise AI!</p>
          
          <p>Best regards,<br>The Gradewise AI Team</p>
        </div>
        <div class="footer">
          <p>© 2025 Gradewise AI. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail(email, subject, htmlContent);
};

/**
 * Send role change notification email
 */
export const sendRoleChangeEmail = async (email, name, oldRole, newRole) => {
  const roleToDashboardPath = {
    student: "/student/dashboard",
    instructor: "/instructor/dashboard",
    admin: "/admin/dashboard",
    super_admin: "/super-admin/dashboard",
  };
  const dashboardPath = roleToDashboardPath[newRole] || "/profile";
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const dashboardUrl = `${baseUrl}${dashboardPath}`;

  const subject = `Your Role Has Been Updated - Gradewise AI`;
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Role Update Notification</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        .role-change { background: #dbeafe; border: 1px solid #3b82f6; padding: 15px; border-radius: 6px; margin: 20px 0; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Role Update Notification</h1>
        </div>
        <div class="content">
          <h2>Hi ${name},</h2>
          <p>Your role in Gradewise AI has been updated by an administrator.</p>
          
          <div class="role-change">
            <p><strong>Role Change:</strong></p>
            <p>${oldRole.charAt(0).toUpperCase() + oldRole.slice(1)} → ${newRole.charAt(0).toUpperCase() + newRole.slice(1)}</p>
          </div>
          
          <p>This change gives you access to new features and capabilities. Please log in to your dashboard to explore your updated permissions.</p>
          
          <div style="text-align: center;">
            <a href="${dashboardUrl}" class="button">Go to Dashboard</a>
          </div>
          
          <p>If you have any questions about this change or need help with your new role, please contact our support team.</p>
          
          <p>Best regards,<br>The Gradewise AI Team</p>
        </div>
        <div class="footer">
          <p>© 2025 Gradewise AI. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail(email, subject, htmlContent);
};

/**
 * Send assessment enrollment email to students
 */
export const sendAssessmentEnrollmentEmail = async (email, name, assessmentTitle, dueDate) => {
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const dashboardUrl = `${baseUrl}/student/dashboard`;

  const subject = `New Assessment Available: ${assessmentTitle}`;
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Assessment Available</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #8b5cf6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        .assessment-info { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #8b5cf6; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📝 New Assessment Available</h1>
        </div>
        <div class="content">
          <h2>Hi ${name},</h2>
          <p>You have been enrolled in a new assessment. Here are the details:</p>
          
          <div class="assessment-info">
            <h3>${assessmentTitle}</h3>
            <p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}</p>
          </div>
          
          <p>You can access this assessment from your student dashboard. Make sure to complete it before the due date!</p>
          
          <div style="text-align: center;">
            <a href="${dashboardUrl}" class="button">View Assessment</a>
          </div>
          
          <p><strong>Tips for success:</strong></p>
          <ul>
            <li>Read all instructions carefully before starting</li>
            <li>Ensure you have a stable internet connection</li>
            <li>Complete the assessment in a quiet environment</li>
            <li>Don't wait until the last minute - start early!</li>
          </ul>
          
          <p>Good luck with your assessment!</p>
          
          <p>Best regards,<br>The Gradewise AI Team</p>
        </div>
        <div class="footer">
          <p>© 2025 Gradewise AI. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail(email, subject, htmlContent);
};

/**
 * Send assessment reminder email
 */
export const sendAssessmentReminderEmail = async (email, name, assessmentTitle, dueDate, hoursRemaining) => {
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const dashboardUrl = `${baseUrl}/dashboard`;

  const subject = `⏰ Reminder: ${assessmentTitle} Due Soon`;
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Assessment Reminder</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
        .urgent { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⏰ Assessment Reminder</h1>
        </div>
        <div class="content">
          <h2>Hi ${name},</h2>
          <p>This is a friendly reminder that your assessment is due soon!</p>
          
          <div class="urgent">
            <h3>${assessmentTitle}</h3>
            <p><strong>Due:</strong> ${new Date(dueDate).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}</p>
            <p><strong>Time Remaining:</strong> ${hoursRemaining} hours</p>
          </div>
          
          <p>Don't miss the deadline! Complete your assessment now to ensure your submission is recorded.</p>
          
          <div style="text-align: center;">
            <a href="${dashboardUrl}" class="button">Take Assessment Now</a>
          </div>
          
          <p><strong>Last-minute checklist:</strong></p>
          <ul>
            <li>✅ Stable internet connection</li>
            <li>✅ Quiet study environment</li>
            <li>✅ Sufficient time to complete</li>
            <li>✅ All required materials ready</li>
          </ul>
          
          <p>Best of luck!</p>
          
          <p>Best regards,<br>The Gradewise AI Team</p>
        </div>
        <div class="footer">
          <p>© 2025 Gradewise AI. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail(email, subject, htmlContent);
};

/**
 * Test email configuration
 */
export const testEmailConfiguration = async () => {
  try {
    await transporter.verify();
    return { success: true, message: "Email configuration is valid" };
  } catch (error) {
    console.error("Email configuration error:", error);
    throw new Error(`Email configuration error: ${error.message}`);
  }
};