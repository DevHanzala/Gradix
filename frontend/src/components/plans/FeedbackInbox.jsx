import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import apiClient from "../../lib/apiClient.js";
import { errorMessage } from "../../utils/forms.js";
import { formatDateTime } from "../../utils/format.js";
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, SkeletonList } from "../ui";

/** Super Admin: in-app feedback and contact-form messages. */
function FeedbackInbox() {
  const { t } = useTranslation();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    try {
      setItems((await apiClient.get("/feedback")).data.data);
    } catch (e) {
      setError(errorMessage(e, t("feedback.loadFailed")));
    }
  }, [t]);
  useEffect(() => {
    load();
  }, [load]);
  const mark = async (id, status) => {
    try {
      await apiClient.patch(`/feedback/${id}`, { status });
      setItems((list) => list.map((f) => (f.id === id ? { ...f, status } : f)));
    } catch (e) {
      setError(errorMessage(e, t("feedback.loadFailed")));
    }
  };
  return (
    <Card className="mt-6">
      <CardHeader title={t("feedback.title")} description={t("feedback.description")} />
      <CardBody>
        {error && <Alert tone="danger">{error}</Alert>}
        {!items ? (
          <SkeletonList rows={3} />
        ) : items.length === 0 ? (
          <EmptyState title={t("feedback.empty")} />
        ) : (
          <ul className="space-y-3">
            {items.map((f) => (
              <li key={f.id} className="rounded-card border border-line p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone={f.kind === "contact" ? "primary" : "neutral"}>{t(`feedback.kinds.${f.kind}`)}</Badge>
                  <span className="font-semibold" dir="auto">{f.name || "–"}</span>
                  {f.email && <span className="text-ink-muted" dir="ltr">{f.email}</span>}
                  {f.user_role && <span className="text-ink-muted">· {t(`roles.${f.user_role}`)}</span>}
                  <span className="ms-auto text-ink-muted">{formatDateTime(f.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap text-ink" dir="auto">{f.message}</p>
                {f.page && <p className="mt-1 text-xs text-ink-subtle" dir="ltr">{f.page}</p>}
                <label className="mt-2 inline-flex items-center gap-2 text-sm">
                  {t("feedback.status")}
                  <select value={f.status} onChange={(e) => mark(f.id, e.target.value)} className="min-h-11 rounded-control border border-line-strong px-2">
                    {["new", "read", "done"].map((s) => (
                      <option key={s} value={s}>
                        {t(`feedback.statuses.${s}`)}
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

export default FeedbackInbox;
