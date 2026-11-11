/**
 * Optional error monitoring with Sentry: only when VITE_SENTRY_DSN is set (the SDK is
 * loaded on demand, so it costs nothing otherwise). No personal data is sent: no user,
 * no request bodies (exam answers), no query strings, no form values in breadcrumbs.
 */
export const initMonitoring = async () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  const Sentry = await import("@sentry/react");
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      delete event.user;
      if (event.request) event.request = { url: String(event.request.url || "").split("?")[0] };
      return event;
    },
    beforeBreadcrumb: (crumb) => (["ui.input", "xhr", "fetch", "console"].includes(crumb.category) ? null : crumb),
  });
};
