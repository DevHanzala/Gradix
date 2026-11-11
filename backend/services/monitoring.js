/**
 * Error monitoring with Sentry, only when SENTRY_DSN is set (the SDK is not even loaded
 * otherwise). Nothing personal leaves the server: no request bodies (exam answers),
 * cookies, headers, query strings, IP addresses or user details; only the error, the
 * route and the request ID.
 */
let sentry = null;

export const initMonitoring = async () => {
  if (!process.env.SENTRY_DSN || sentry) return Boolean(sentry);
  const Sentry = await import("@sentry/node");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
    beforeBreadcrumb: (crumb) => (crumb.category === "http" || crumb.category === "console" ? null : crumb),
  });
  sentry = Sentry;
  return true;
};

/** Remove anything that could carry answers or personal data. */
export const scrubEvent = (event) => {
  if (event.request) event.request = { method: event.request.method, url: String(event.request.url || "").split("?")[0] };
  delete event.user;
  delete event.extra;
  if (event.contexts) delete event.contexts.request;
  return event;
};

export const captureError = (error, req) => {
  if (!sentry) return;
  sentry.withScope((scope) => {
    if (req?.id) scope.setTag("request_id", req.id);
    if (req) scope.setTag("route", req.baseUrl + req.path);
    sentry.captureException(error);
  });
};

export const flushMonitoring = async () => {
  if (sentry) await sentry.flush(2000).catch(() => {});
};
