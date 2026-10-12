const HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape text for safe interpolation into HTML (emails, PDF templates). */
export const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);

/** Escape and keep line breaks visible. */
export const escapeHtmlMultiline = (value) => escapeHtml(value).replace(/\r?\n/g, "<br />");
