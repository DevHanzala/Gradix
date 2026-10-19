import { useCallback, useEffect, useState } from "react";
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
      setError(errorMessage(e, "Could not load publishing progress."));
    }
  }, [assessmentId, status, onStatusChange]);

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
      setError(errorMessage(e, "Could not start publishing."));
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
      setError(errorMessage(e, "Could not retry."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader
        title={publishing ? "Publishing" : "Publish"}
        description={
          publishing
            ? "Questions are prepared and checked in advance for every language, so students never wait for the AI."
            : "Prepare a checked pool of questions in each language. Objectives and settings are locked after publishing."
        }
        actions={
          publishing && (
            <Button variant="secondary" icon={FaDatabase} to={`/instructor/assessments/${assessmentId}/questions`}>
              Question bank
            </Button>
          )
        }
      />
      <CardBody className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        {!publishing && (
          <>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-ink">Languages students can choose</legend>
              <div className="grid gap-1 sm:grid-cols-2">
                {Object.entries(LANGUAGE_NAMES).map(([code, name]) => (
                  <Checkbox
                    key={code}
                    label={name}
                    description={code === "fa" ? "Optional" : undefined}
                    checked={languages.includes(code)}
                    onChange={() => toggle(code)}
                    disabled={!canPublish}
                  />
                ))}
              </div>
            </fieldset>
            {!canPublish && <p className="text-sm text-ink-muted">Save at least one objective first.</p>}
            <Button icon={FaPaperPlane} onClick={() => setConfirming(true)} disabled={!canPublish || languages.length === 0} loading={busy}>
              Publish
            </Button>
          </>
        )}

        {publishing && !pool && (
          <div className="space-y-3" role="status" aria-label="Loading">
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
                      {l.questions} / {l.target} questions
                    </span>
                    {l.state === "failed" ? (
                      <Badge tone="danger">Failed</Badge>
                    ) : l.ready ? (
                      <Badge tone="success">Students can start</Badge>
                    ) : (
                      <Badge tone="primary">Preparing…</Badge>
                    )}
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-gray-100"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={l.percent}
                  aria-label={`${LANGUAGE_NAMES[l.language] || l.language} progress`}
                >
                  <div className={`h-full rounded-full ${l.state === "failed" ? "bg-danger-600" : "bg-primary-600"}`} style={{ width: `${l.percent}%` }} />
                </div>
                {l.error && <p className="mt-1 text-sm text-danger-700">{l.error}</p>}
              </li>
            ))}
          </ul>
        )}
        {pool?.languages?.some((l) => l.state === "failed") && (
          <Button variant="secondary" icon={FaRedo} onClick={retry} loading={busy}>
            Retry failed languages
          </Button>
        )}
      </CardBody>

      <Modal isOpen={confirming} onClose={() => setConfirming(false)} title="Publish this assessment?" type="warning" onConfirm={publish} confirmText="Publish">
        Objectives, question settings and source material will be locked. Questions are then prepared in {languages.length} language
        {languages.length === 1 ? "" : "s"}; students can start as soon as their language is ready.
      </Modal>
    </Card>
  );
}

export default PublishPanel;
