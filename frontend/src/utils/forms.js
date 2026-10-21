import i18n from "../i18n/index.js";

/**
 * Schema messages are i18n keys, optionally with one value: "validation.atMost|100".
 * Returns the translated message (the value is available as {{value}}).
 */
export const translateIssue = (message) => {
  const [key, value] = String(message).split("|");
  return i18n.t(key, { value, defaultValue: message });
};

/**
 * Run a zod schema and return { data, errors } where `errors` maps each field
 * to its first message (or is null when the input is valid). Schema messages
 * are i18n keys (e.g. "validation.emailInvalid") and are translated here.
 */
export const validateWith = (schema, values) => {
  const result = schema.safeParse(values);
  if (result.success) return { data: result.data, errors: null };
  const errors = {};
  for (const issue of result.error.issues) {
    const key = issue.path?.[0] ?? "_form";
    if (!errors[key]) errors[key] = translateIssue(issue.message);
  }
  return { data: null, errors };
};

/**
 * User-facing message for an API error, a store-rethrown API body or a plain Error.
 * In English the server's (specific) message is shown. In other languages the
 * error code's translation is preferred, falling back to the server message.
 */
export const errorMessage = (error, fallback) => {
  const body = error?.response?.data || error;
  const code = body?.code;
  if (code && i18n.language !== "en" && i18n.exists(`errors.codes.${code}`)) return i18n.t(`errors.codes.${code}`);
  if (!error?.response && !body?.message && error?.message === "Network Error") return i18n.t("errors.network");
  return body?.message || error?.message || fallback || i18n.t("errors.generic");
};
