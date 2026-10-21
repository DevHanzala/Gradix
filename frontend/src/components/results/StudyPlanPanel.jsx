import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FaBookOpen, FaMagic, FaRedo } from "react-icons/fa";
import { fetchStudyPlanAPI } from "../../api/studentAnalytics.api.js";
import { errorMessage } from "../../utils/forms.js";
import { isRtl } from "../../utils/languages.js";
import { textDirection } from "../../utils/text.js";
import { Alert, Badge, Button, EmptyState } from "../ui";

/** AI study plan in the student's language, with the source passages to re-read. */
function StudyPlanPanel({ assessmentId, language, hasObjectives, onCreated }) {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const tPlan = i18n.getFixedT(language);

  const load = async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchStudyPlanAPI(assessmentId, { language, refresh });
      setData(res.data.data);
      onCreated?.();
    } catch (e) {
      setError(errorMessage(e, t("learning.planFailed")));
    } finally {
      setLoading(false);
    }
  };

  if (!hasObjectives) return <p className="text-sm text-ink-muted">{t("learning.noObjectives")}</p>;
  if (!data) {
    return (
      <>
        {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
        <EmptyState
          icon={FaMagic}
          title={t("learning.planTitle")}
          description={t("learning.planEmpty")}
          action={
            <Button icon={FaMagic} loading={loading} onClick={() => load(false)}>
              {loading ? t("learning.planGenerating") : t("learning.planCreate")}
            </Button>
          }
        />
      </>
    );
  }

  const { plan, source } = data;
  const dir = isRtl(data.language) ? "rtl" : "ltr";
  return (
    <div dir={dir} lang={data.language} className="space-y-5">
      {source === "fallback" && (
        <Alert tone="info">{tPlan("learning.planFallback")}</Alert>
      )}
      {plan.summary && <p className="text-ink">{plan.summary}</p>}
      <ol className="space-y-4">
        {plan.steps.map((s, i) => (
          <li key={`${s.objectiveId}-${i}`} className="rounded-card border border-line p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-700">{i + 1}</span>
              <h3 className="font-semibold text-ink">{s.focus}</h3>
              {s.objectiveNumber && <Badge>{tPlan("learning.objectiveBadge", { number: s.objectiveNumber })}</Badge>}
            </div>
            {s.why && <p className="mb-2 text-sm text-ink-muted">{s.why}</p>}
            <ul className="list-disc space-y-1 ps-5 text-sm text-ink">
              {s.activities.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            {s.passages?.length > 0 && (
              <details className="mt-3">
                <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-primary-700">
                  <FaBookOpen aria-hidden="true" />
                  {tPlan("learning.passages", { count: s.passages.length })}
                </summary>
                <div className="mt-2 space-y-2">
                  {s.passages.map((p) => (
                    <blockquote key={p.chunkId} className="rounded-control border-s-4 border-primary-200 bg-canvas p-3 text-sm">
                      <p className="mb-1 font-semibold text-ink" dir="auto">
                        {p.resourceName}
                      </p>
                      <p className="text-ink-muted" dir={textDirection(p.excerpt)}>
                        {p.excerpt}…
                      </p>
                    </blockquote>
                  ))}
                </div>
              </details>
            )}
          </li>
        ))}
      </ol>
      {plan.encouragement && <p className="italic text-ink-muted">{plan.encouragement}</p>}
      <Button variant="secondary" icon={FaRedo} loading={loading} onClick={() => load(true)}>
        {t("learning.planRefresh")}
      </Button>
    </div>
  );
}

export default StudyPlanPanel;
