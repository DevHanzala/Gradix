import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaDatabase, FaPaperPlane, FaRedo } from "react-icons/fa";
import { fetchPoolStatusApi, publishAssessmentApi, retryPublishApi } from "../../api/assessment.api.js";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Checkbox, Modal, Skeleton } from "../ui";
import { errorMessage } from "../../utils/forms.js";
import { LANGUAGE_NAMES } from "../../utils/languages.js";

const POLL_MS = 3000;
const DEFAULT_LANGUAGES = ["en", "ur", "ar"];

/**
 * Publishing: choose languages, start pre-generation, and follow its progress
 * per language. Shown on the objectives page once objectives are ready.
 */
function PublishPanel({ assessmentId, status, canPublish, onStatusChange }) {
  const { t } = useTranslation();
  const [languages, setLanguages] = useState(DEFAULT_LANGUAGES);
  const [pool, setPool] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const publishing = status === "publishing" || status === "published";

  const load = useCallback(async () => {
    try {
      const res = await fetchPoolStatusApi(assessmentId);
      setPool(res.data.data);
      setError(null);
      if (res.data.data.status !== status) onStatusChange?.(res.data.data.status);
    } catch (e) {
      setError(errorMessage(e, t("publish.loadFailed")));
    }
  }, [assessmentId, status, onStatusChange, t]);

  useEffect(() => {
    if (publishing) load();
  }, [publishing, load]);

  const filling = pool?.languages?.some((l) => l.state === "filling");
  useEffect(() => {
    if (!filling) return undefined;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [filling, load]);

  const toggle = (code) =>
    setLanguages((list) => (list.includes(code) ? list.filter((l) => l !== code) : [...list, code]));

  const publish = async () => {
    setConfirming(false);
    setBusy(true);
    setError(null);
    try {
      const res = await publishAssessmentApi(assessmentId, languages);
      setPool(res.data.data);
      onStatusChange?.(res.data.data.status);
    } catch (e) {
      setError(errorMessage(e, t("publish.startFailed")));
    } finally {
      setBusy(false);
    }
  };

  const retry = async () => {
    setBusy(true);
    try {
      const res = await retryPublishApi(assessmentId);
      setPool(res.data.data);
    } catch (e) {
      setError(errorMessage(e, t("publish.retryFailed")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader
        title={publishing ? t("publish.titlePublishing") : t("publish.title")}
        description={publishing ? t("publish.descriptionPublishing") : t("publish.description")}
        actions={
          publishing && (
            <Button variant="secondary" icon={FaDatabase} to={`/instructor/assessments/${assessmentId}/questions`}>
              {t("bank.title")}
            </Button>
          )
        }
      />
      <CardBody className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        {!publishing && (
          <>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-ink">{t("publish.languages")}</legend>
              <div className="grid gap-1 sm:grid-cols-2">
                {Object.entries(LANGUAGE_NAMES).map(([code, name]) => (
                  <Checkbox
                    key={code}
                    label={name}
                    description={code === "fa" ? t("common.optional") : undefined}
                    checked={languages.includes(code)}
                    onChange={() => toggle(code)}
                    disabled={!canPublish}
                  />
                ))}
              </div>
            </fieldset>
            {!canPublish && <p className="text-sm text-ink-muted">{t("publish.saveFirst")}</p>}
            <Button icon={FaPaperPlane} onClick={() => setConfirming(true)} disabled={!canPublish || languages.length === 0} loading={busy}>
              {t("publish.publish")}
            </Button>
          </>
        )}

        {publishing && !pool && (
          <div className="space-y-3" role="status" aria-label={t("common.loading")}>
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-full" />
          </div>
        )}

        {publishing && pool && (
          <ul className="space-y-4">
            {pool.languages.map((l) => (
              <li key={l.language}>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-semibold text-ink">{LANGUAGE_NAMES[l.language] || l.language}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-ink-muted">
                      {t("publish.questionsOf", { have: l.questions, target: l.target })}
                    </span>
                    {l.state === "failed" ? (
                      <Badge tone="danger">{t("publish.failed")}</Badge>
                    ) : l.ready ? (
                      <Badge tone="success">{t("publish.ready")}</Badge>
                    ) : (
                      <Badge tone="primary">{t("publish.preparing")}</Badge>
                    )}
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-gray-100"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={l.percent}
                  aria-label={t("publish.progressFor", { language: LANGUAGE_NAMES[l.language] || l.language })}
                >
                  <div className={`h-full rounded-full ${l.state === "failed" ? "bg-danger-600" : "bg-primary-600"}`} style={{ width: `${l.percent}%` }} />
                </div>
                {l.state === "failed" && <p className="mt-1 text-sm text-danger-700">{t("publish.failedBody")}</p>}
              </li>
            ))}
          </ul>
        )}
        {pool?.languages?.some((l) => l.state === "failed") && (
          <Button variant="secondary" icon={FaRedo} onClick={retry} loading={busy}>
            {t("publish.retry")}
          </Button>
        )}
      </CardBody>

      <Modal
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        title={t("publish.confirmTitle")}
        type="warning"
        onConfirm={publish}
        confirmText={t("publish.publish")}
      >
        {t("publish.confirmBody", { count: languages.length })}
      </Modal>
    </Card>
  );
}

export default PublishPanel;
