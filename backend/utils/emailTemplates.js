export const verificationEmailTemplate = ({ name, verificationUrl }) => ({
  subject: "Verify Your Email - Gradewise AI",
  html: `
<!DOCTYPE html>
<html>
<body>
  <h2>Hi ${name},</h2>
  <p>Please verify your email by clicking below:</p>
  <a href="${verificationUrl}">Verify Email</a>
  <p>This link expires in 24 hours.</p>
</body>
</html>
`,
});

export const passwordResetEmailTemplate = ({ name, resetUrl }) => ({
  subject: "Reset Your Password - Gradewise AI",
  html: `
<!DOCTYPE html>
<html>
<body>
  <h2>Hi ${name},</h2>
  <p>Reset your password using the link below:</p>
  <a href="${resetUrl}">Reset Password</a>
  <p>This link expires in 1 hour.</p>
</body>
</html>
`,
});

export const welcomeEmailTemplate = ({ name, role, dashboardUrl }) => ({
  subject: "Welcome to Gradewise AI",
  html: `
<!DOCTYPE html>
<html>
<body>
  <h2>Welcome ${name}!</h2>
  <p>Your role: <strong>${role}</strong></p>
  <a href="${dashboardUrl}">Go to Dashboard</a>
</body>
</html>
`,
});

export const roleChangeEmailTemplate = ({ name, oldRole, newRole, dashboardUrl }) => ({
  subject: "Your Role Has Been Updated - Gradewise AI",
  html: `
<!DOCTYPE html>
<html>
<body>
  <h2>Hi ${name},</h2>
  <p>Your role changed from <b>${oldRole}</b> to <b>${newRole}</b>.</p>
  <a href="${dashboardUrl}">Open Dashboard</a>
</body>
</html>
`,
});

export const assessmentEnrollmentTemplate = ({ name, assessmentTitle, dueDate, dashboardUrl }) => ({
  subject: `New Assessment: ${assessmentTitle}`,
  html: `
<!DOCTYPE html>
<html>
<body>
  <h2>Hi ${name},</h2>
  <p>You have been enrolled in <strong>${assessmentTitle}</strong></p>
  <p>Due: ${new Date(dueDate).toLocaleString()}</p>
  <a href="${dashboardUrl}">View Assessment</a>
</body>
</html>
`,
});

export const assessmentReminderTemplate = ({ name, assessmentTitle, dueDate, hoursRemaining, dashboardUrl }) => ({
  subject: `⏰ Reminder: ${assessmentTitle}`,
  html: `
<!DOCTYPE html>
<html>
<body>
  <h2>Hi ${name},</h2>
  <p><strong>${assessmentTitle}</strong> is due soon.</p>
  <p>Due: ${new Date(dueDate).toLocaleString()}</p>
  <p>Time remaining: ${hoursRemaining} hours</p>
  <a href="${dashboardUrl}">Take Assessment</a>
</body>
</html>
`,
});
