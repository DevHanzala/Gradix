import { escapeHtml } from "./escapeHtml.js";
import { translate, isRtl, normalizeLanguage } from "../helper/i18n.js";

// Every email is written in the recipient's language (users.language_preference)
// with the right direction and fonts. Every interpolated value is escaped; URLs
// are built by the server but are escaped as attribute values too.

const FONTS = {
  ur: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', Tahoma, serif",
  ar: "'Noto Naskh Arabic', Tahoma, serif",
  fa: "'Noto Naskh Arabic', Tahoma, serif",
  en: "Arial, Helvetica, sans-serif",
};

const layout = (lang, body) => {
  const language = normalizeLanguage(lang);
  const dir = isRtl(language) ? "rtl" : "ltr";
  return `<!DOCTYPE html>
<html lang="${language}" dir="${dir}">
<body dir="${dir}" style="font-family: ${FONTS[language]}; color: #1f2937; line-height: ${language === "ur" ? 2.2 : 1.6}; text-align: ${dir === "rtl" ? "right" : "left"};">
${body}
<p style="color: #6b7280; font-size: 12px;">${escapeHtml(translate(language, "email.footer"))}</p>
</body>
</html>`;
};

const button = (url, label) =>
  `<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 18px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;">${escapeHtml(label)}</a></p>`;

/** Translate with every parameter HTML-escaped. */
const tx = (lang, key, params = {}) =>
  translate(lang, key, Object.fromEntries(Object.entries(params).map(([k, v]) => [k, escapeHtml(v)])));

const greeting = (lang, name) => `<h2>${tx(lang, "email.greeting", { name })}</h2>`;

export const verificationEmailTemplate = ({ lang, name, verificationUrl }) => ({
  subject: translate(lang, "email.verify.subject"),
  html: layout(
    lang,
    `${greeting(lang, name)}
  <p>${tx(lang, "email.verify.body")}</p>
  ${button(verificationUrl, translate(lang, "email.verify.button"))}
  <p>${tx(lang, "email.verify.expiry")}</p>`
  ),
});

export const passwordResetEmailTemplate = ({ lang, name, resetUrl }) => ({
  subject: translate(lang, "email.reset.subject"),
  html: layout(
    lang,
    `${greeting(lang, name)}
  <p>${tx(lang, "email.reset.body")}</p>
  ${button(resetUrl, translate(lang, "email.reset.button"))}
  <p>${tx(lang, "email.reset.expiry")}</p>`
  ),
});

export const passwordChangedEmailTemplate = ({ lang, name, changedAt }) => ({
  subject: translate(lang, "email.passwordChanged.subject"),
  html: layout(
    lang,
    `${greeting(lang, name)}
  <p>${tx(lang, "email.passwordChanged.body", { date: changedAt })}</p>
  <p>${tx(lang, "email.passwordChanged.warning")}</p>`
  ),
});

export const roleChangeEmailTemplate = ({ lang, name, oldRole, newRole, dashboardUrl }) => ({
  subject: translate(lang, "email.roleChanged.subject"),
  html: layout(
    lang,
    `${greeting(lang, name)}
  <p>${tx(lang, "email.roleChanged.body", {
    oldRole: translate(lang, `role.${oldRole}`),
    newRole: translate(lang, `role.${newRole}`),
  })}</p>
  ${button(dashboardUrl, translate(lang, "email.roleChanged.button"))}`
  ),
});

export const assessmentEnrollmentTemplate = ({ lang, name, assessmentTitle, instructorName, enrolledAt, dashboardUrl }) => ({
  subject: translate(lang, "email.enrolled.subject", { title: assessmentTitle }),
  html: layout(
    lang,
    `${greeting(lang, name)}
  <p>${
    instructorName
      ? tx(lang, "email.enrolled.bodyBy", { title: assessmentTitle, instructor: instructorName })
      : tx(lang, "email.enrolled.body", { title: assessmentTitle })
  }</p>
  <p>${tx(lang, "email.enrolled.date", { date: enrolledAt })}</p>
  ${button(dashboardUrl, translate(lang, "email.enrolled.button"))}`
  ),
});

export const accountDeletedEmailTemplate = ({ lang, name }) => ({
  subject: translate(lang, "email.accountDeleted.subject"),
  html: layout(
    lang,
    `${greeting(lang, name)}
  <p>${tx(lang, "email.accountDeleted.body")}</p>
  <p>${tx(lang, "email.accountDeleted.contact")}</p>`
  ),
});

export const assessmentPublishedTemplate = ({ lang, name, assessmentTitle, dashboardUrl }) => ({
  subject: translate(lang, "email.published.subject", { title: assessmentTitle }),
  html: layout(
    lang,
    `${greeting(lang, name)}
  <p>${tx(lang, "email.published.body", { title: assessmentTitle })}</p>
  ${button(dashboardUrl, translate(lang, "email.published.button"))}`
  ),
});

export const resultsReadyTemplate = ({ lang, name, assessmentTitle, percentage, resultsUrl }) => ({
  subject: translate(lang, "email.resultsReady.subject", { title: assessmentTitle }),
  html: layout(
    lang,
    `${greeting(lang, name)}
  <p>${tx(lang, "email.resultsReady.body", { title: assessmentTitle, percentage })}</p>
  ${button(resultsUrl, translate(lang, "email.resultsReady.button"))}`
  ),
});
