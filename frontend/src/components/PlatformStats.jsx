import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaClipboardCheck, FaDatabase, FaLayerGroup, FaRobot } from "react-icons/fa";
import { fetchPlatformStatsApi } from "../api/admin.api.js";
import { errorMessage } from "../utils/forms.js";
import { formatNumber } from "../utils/format.js";
import { Alert, Button, Card, CardHeader, ResponsiveTable, Select, SkeletonList, StatCard } from "./ui";

const usd = (n) => formatNumber(n || 0, { style: "currency", currency: "USD", maximumFractionDigits: 2 });

/** Super Admin: platform activity and LLM usage with an estimated cost. */
function PlatformStats() {
  const { t } = useTranslation();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData((await fetchPlatformStatsApi(days)).data.data);
    } catch (e) {
      setError(errorMessage(e, t("platform.loadFailed")));
    }
  }, [days, t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section aria-labelledby="platform-stats" className="mt-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 id="platform-stats" className="text-xl font-bold text-ink">
          {t("platform.title")}
        </h2>
        <Select
          label={t("platform.period")}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          options={[7, 30, 90, 365].map((d) => ({ value: d, label: t("platform.lastDays", { count: d }) }))}
        />
      </div>
      {error ? (
        <Alert
          tone="danger"
          action={
            <Button variant="secondary" onClick={load}>
              {t("common.tryAgain")}
            </Button>
          }
        >
          {error}
        </Alert>
      ) : !data ? (
        <Card>
          <SkeletonList rows={3} />
        </Card>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label={t("platform.completedAttempts")} value={formatNumber(data.attempts.completed_recent)} icon={FaClipboardCheck} hint={t("platform.allTime", { count: formatNumber(data.attempts.completed) })} />
            <StatCard label={t("platform.poolQuestions")} value={formatNumber(data.pool.active)} icon={FaDatabase} hint={t("platform.publishedAssessments", { count: formatNumber(data.assessments.published || 0) })} />
            <StatCard label={t("platform.llmCalls")} value={formatNumber(data.llm.calls)} icon={FaRobot} hint={t("platform.failed", { count: formatNumber(data.llm.failed) })} />
            <StatCard label={t("platform.estimatedCost")} value={usd(data.llm.estimatedCostUsd)} icon={FaLayerGroup} hint={t("platform.tokens", { input: formatNumber(data.llm.inputTokens), output: formatNumber(data.llm.outputTokens) })} />
          </div>
          {data.llm.unpricedModels.length > 0 && (
            <Alert tone="warning" className="mb-4">
              {t("platform.unpriced", { models: data.llm.unpricedModels.join(", ") })}
            </Alert>
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title={t("platform.byModel")} />
              <ResponsiveTable
                caption={t("platform.byModel")}
                rowKey={(r) => `${r.provider}-${r.model}`}
                rows={data.llm.byModel}
                columns={[
                  { key: "model", header: t("platform.model"), primary: true, render: (r) => <span dir="ltr">{r.model ? `${r.provider} · ${r.model}` : r.provider}</span> },
                  { key: "calls", header: t("platform.calls"), render: (r) => formatNumber(r.calls) },
                  { key: "latency", header: t("platform.latency"), render: (r) => formatNumber(r.avgLatencyMs, { style: "unit", unit: "millisecond", unitDisplay: "short" }) },
                  { key: "cost", header: t("platform.cost"), render: (r) => (r.estimatedCostUsd === null ? "–" : usd(r.estimatedCostUsd)) },
                ]}
              />
            </Card>
            <Card>
              <CardHeader title={t("platform.byPurpose")} />
              <ResponsiveTable
                caption={t("platform.byPurpose")}
                rowKey={(r) => r.purpose}
                rows={data.llm.byPurpose}
                columns={[
                  { key: "purpose", header: t("platform.purpose"), primary: true, render: (r) => t(`platform.purposes.${r.purpose}`, { defaultValue: r.purpose }) },
                  { key: "calls", header: t("platform.calls"), render: (r) => formatNumber(r.calls) },
                  { key: "failed", header: t("platform.failedShort"), render: (r) => formatNumber(r.failed) },
                ]}
              />
            </Card>
          </div>
          <p className="mt-3 text-xs text-ink-subtle">{t("platform.costNote")}</p>
        </>
      )}
    </section>
  );
}

export default PlatformStats;
