import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import apiClient from "../../lib/apiClient.js";
import { formatNumber } from "../../utils/format.js";
import { Card, CardBody, CardHeader } from "../ui";

const METRICS = ["assessmentsPerMonth", "students", "aiQuestionsPerMonth", "storageMb"];

/** The instructor's plan and how much of each limit is used (with an upgrade hint near the limit). */
function UsageCard() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  useEffect(() => {
    apiClient
      .get("/plans/me")
      .then((res) => setData(res.data.data))
      .catch(() => setData(null));
  }, []);
  if (!data) return null;
  const near = METRICS.some((m) => data.limits[m] !== null && data.usage[m] >= data.limits[m] * 0.8);
  return (
    <Card className="mb-6">
      <CardHeader title={t("plans.yourPlan", { plan: t(`plans.names.${data.plan}`) })} description={t("plans.usageDescription")} />
      <CardBody className="space-y-3">
        {METRICS.map((m) => {
          const limit = data.limits[m];
          const used = data.usage[m];
          const percent = limit ? Math.min(100, Math.round((100 * used) / limit)) : 0;
          return (
            <div key={m}>
              <div className="mb-1 flex justify-between gap-3 text-sm">
                <span className="text-ink">{t(`plans.metrics.${m}`)}</span>
                <span className="tabular-nums text-ink-muted">
                  {limit === null ? t("plans.usedUnlimited", { used: formatNumber(used) }) : t("plans.usedOf", { used: formatNumber(used), limit: formatNumber(limit) })}
                </span>
              </div>
              {limit !== null && (
                <div className="h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={t(`plans.metrics.${m}`)}>
                  <div className={`h-full rounded-full ${percent >= 100 ? "bg-danger-600" : percent >= 80 ? "bg-warning-600" : "bg-primary-500"}`} style={{ width: `${percent}%` }} />
                </div>
              )}
            </div>
          );
        })}
        {near && <p className="rounded-control bg-warning-50 p-3 text-sm text-warning-700">{t("plans.upgradeHint")}</p>}
      </CardBody>
    </Card>
  );
}

export default UsageCard;
