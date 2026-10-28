import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaBan, FaCheckCircle, FaClipboardCheck, FaDatabase, FaExclamationTriangle, FaHourglassHalf, FaKey, FaRobot } from "react-icons/fa";
import { fetchPlatformStatsApi } from "../api/admin.api.js";
import { errorMessage } from "../utils/forms.js";
import { formatDateTime, formatNumber } from "../utils/format.js";
import TokensPerDay from "./insights/TokensPerDay.jsx";
import { Alert, Badge, Button, Card, CardBody, CardHeader, ResponsiveTable, Select, SkeletonList, StatCard } from "./ui";

const STATUS = {
  ok: { tone: "success", icon: FaCheckCircle },
  low: { tone: "warning", icon: FaExclamationTriangle },
  cooling: { tone: "warning", icon: FaHourglassHalf },
  exhausted: { tone: "danger", icon: FaBan },
};

/** "used / limit" when the plan has a limit, otherwise just the used amount. */
const usedOf = (used, limit) => (limit === null || limit === undefined ? formatNumber(used) : `${formatNumber(used)} / ${formatNumber(limit)}`);

/** Share of today's free quota used (the larger of requests and tokens). */
const usedShare = (k) =>
  Math.min(1, Math.max(k.limits.rpd ? k.today.requests / k.limits.rpd : 0, k.limits.tpd ? k.today.tokens / k.limits.tpd : 0));

/** Super Admin: platform activity and AI usage per day and per API key (free plans, so no cost). */
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

  const llm = data?.llm;
  const left = (k) => {
    const parts = [];
    if (k.left.requests !== null) parts.push(t("platform.requestsLeft", { count: formatNumber(k.left.requests) }));
    if (k.left.tokens !== null) parts.push(t("platform.tokensLeft", { count: formatNumber(k.left.tokens) }));
    return parts.length ? parts.join(" · ") : "–";
  };

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
          options={[7, 30, 90].map((d) => ({ value: d, label: t("platform.lastDays", { count: d }) }))}
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
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={t("platform.completedAttempts")}
              value={formatNumber(data.attempts.completed_recent)}
              icon={FaClipboardCheck}
              hint={t("platform.allTime", { count: formatNumber(data.attempts.completed) })}
            />
            <StatCard
              label={t("platform.poolQuestions")}
              value={formatNumber(data.pool.active)}
              icon={FaDatabase}
              hint={t("platform.publishedAssessments", { count: formatNumber(data.assessments.published || 0) })}
            />
            <StatCard
              label={t("platform.requestsToday")}
              value={formatNumber(llm.today.requests)}
              icon={FaRobot}
              hint={t("platform.keysAvailable", { count: formatNumber(llm.today.keysAvailable), total: formatNumber(llm.keys.length) })}
            />
            <StatCard
              label={t("platform.tokensToday")}
              value={formatNumber(llm.today.tokens)}
              icon={FaKey}
              hint={
                llm.today.requestsLeft === null
                  ? t("platform.failed", { count: formatNumber(llm.failed) })
                  : t("platform.requestsLeftToday", { count: formatNumber(llm.today.requestsLeft) })
              }
            />
          </div>

          {llm.keys.length > 0 && llm.today.keysAvailable === 0 && (
            <Alert tone="danger" title={t("platform.allKeysUsedTitle")} className="mb-6">
              {t("platform.allKeysUsedBody")}
            </Alert>
          )}

          <Card className="mb-6">
            <CardHeader title={t("platform.keysTitle")} description={t("platform.keysDescription")} />
            {llm.keys.length === 0 ? (
              <CardBody>
                <p className="text-sm text-ink-muted">{t("platform.noKeys")}</p>
              </CardBody>
            ) : (
              <ResponsiveTable
                caption={t("platform.keysTitle")}
                rowKey={(k) => k.label}
                rows={llm.keys}
                columns={[
                  {
                    key: "key",
                    header: t("platform.key"),
                    primary: true,
                    render: (k) => (
                      <span dir="ltr" className="font-semibold text-ink">
                        {k.label} <span className="font-normal text-ink-muted">· {k.model}</span>
                      </span>
                    ),
                  },
                  {
                    key: "requests",
                    header: t("platform.requestsUsed"),
                    render: (k) => (
                      <div className="min-w-28">
                        <span className="tabular-nums">{usedOf(k.today.requests, k.limits.rpd)}</span>
                        <div
                          className="mt-1 h-1.5 w-full rounded-full bg-primary-50"
                          role="meter"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(usedShare(k) * 100)}
                          aria-label={t("platform.quotaUsed", { label: k.label })}
                        >
                          <div className="h-1.5 rounded-full bg-primary-600" style={{ width: `${usedShare(k) * 100}%` }} />
                        </div>
                      </div>
                    ),
                  },
                  { key: "tokens", header: t("platform.tokensUsed"), render: (k) => <span className="tabular-nums">{usedOf(k.today.tokens, k.limits.tpd)}</span> },
                  { key: "left", header: t("platform.left"), render: (k) => left(k) },
                  {
                    key: "status",
                    header: t("platform.status"),
                    render: (k) => (
                      <Badge tone={STATUS[k.status].tone} icon={STATUS[k.status].icon}>
                        {t(`platform.keyStatus.${k.status}`)}
                      </Badge>
                    ),
                  },
                  { key: "resets", header: t("platform.resets"), render: (k) => (k.resetsAt ? formatDateTime(k.blockedUntil && k.status === "cooling" ? k.blockedUntil : k.resetsAt) : "–") },
                ]}
              />
            )}
            <p className="px-4 pb-4 pt-2 text-xs text-ink-subtle sm:px-6">{t("platform.limitsNote")}</p>
          </Card>

          <Card className="mb-6">
            <CardHeader title={t("platform.tokensPerDay")} description={t("platform.lastDays", { count: llm.daily.length })} />
            <CardBody>
              <TokensPerDay days={llm.daily} />
            </CardBody>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title={t("platform.byModel")} />
              <ResponsiveTable
                caption={t("platform.byModel")}
                rowKey={(r) => `${r.provider}-${r.model}`}
                rows={llm.byModel}
                columns={[
                  { key: "model", header: t("platform.model"), primary: true, render: (r) => <span dir="ltr">{r.model ? `${r.provider} · ${r.model}` : r.provider}</span> },
                  { key: "calls", header: t("platform.calls"), render: (r) => formatNumber(r.calls) },
                  { key: "tokens", header: t("platform.tokensShort"), render: (r) => formatNumber(r.inputTokens + r.outputTokens) },
                  { key: "latency", header: t("platform.latency"), render: (r) => formatNumber(r.avgLatencyMs, { style: "unit", unit: "millisecond", unitDisplay: "short" }) },
                ]}
              />
            </Card>
            <Card>
              <CardHeader title={t("platform.byPurpose")} />
              <ResponsiveTable
                caption={t("platform.byPurpose")}
                rowKey={(r) => r.purpose}
                rows={llm.byPurpose}
                columns={[
                  { key: "purpose", header: t("platform.purpose"), primary: true, render: (r) => t(`platform.purposes.${r.purpose}`, { defaultValue: r.purpose }) },
                  { key: "calls", header: t("platform.calls"), render: (r) => formatNumber(r.calls) },
                  { key: "tokens", header: t("platform.tokensShort"), render: (r) => formatNumber(r.input_tokens + r.output_tokens) },
                  { key: "failed", header: t("platform.failedShort"), render: (r) => formatNumber(r.failed) },
                ]}
              />
            </Card>
          </div>
        </>
      )}
    </section>
  );
}

export default PlatformStats;
