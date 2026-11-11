import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import apiClient from "../../lib/apiClient.js";
import { errorMessage } from "../../utils/forms.js";
import { formatNumber } from "../../utils/format.js";
import { Alert, Card, CardBody, CardHeader, ResponsiveTable, SkeletonList } from "../ui";

const PLAN_IDS = ["free", "pro", "institution"];

/** Super Admin: assign plans to instructors and groups and see each account's usage. */
function PlansAdmin() {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState(null);
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [a, g] = await Promise.all([apiClient.get("/plans/accounts"), apiClient.get("/plans/groups")]);
      setAccounts(a.data.data);
      setGroups(g.data.data);
      setError(null);
    } catch (e) {
      setError(errorMessage(e, t("plans.loadFailed")));
    }
  }, [t]);
  useEffect(() => {
    load();
  }, [load]);

  const change = async (url, plan) => {
    try {
      await apiClient.put(url, { plan });
      await load();
    } catch (e) {
      setError(errorMessage(e, t("plans.saveFailed")));
    }
  };
  const select = (value, onChange, label, allowNone = false) => (
    <select aria-label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className="min-h-11 rounded-control border border-line-strong px-2">
      {allowNone && <option value="">{t("plans.noGroupPlan")}</option>}
      {PLAN_IDS.map((p) => (
        <option key={p} value={p}>
          {t(`plans.names.${p}`)}
        </option>
      ))}
    </select>
  );
  const usage = (a, m) => (a.limits[m] === null ? formatNumber(a.usage[m]) : `${formatNumber(a.usage[m])} / ${formatNumber(a.limits[m])}`);

  return (
    <Card className="mt-6">
      <CardHeader title={t("plans.adminTitle")} description={t("plans.adminDescription")} />
      <CardBody className="space-y-6">
        {error && <Alert tone="danger">{error}</Alert>}
        {!accounts ? (
          <SkeletonList rows={3} />
        ) : (
          <ResponsiveTable
            caption={t("plans.accounts")}
            rows={accounts}
            columns={[
              { key: "name", header: t("plans.account"), primary: true, render: (a) => <span dir="auto">{a.name}</span> },
              { key: "plan", header: t("plans.ownPlan"), render: (a) => select(a.ownPlan, (p) => change(`/plans/users/${a.id}`, p), t("plans.planFor", { name: a.name })) },
              { key: "effective", header: t("plans.effectivePlan"), render: (a) => t(`plans.names.${a.plan}`) },
              { key: "assessments", header: t("plans.metrics.assessmentsPerMonth"), render: (a) => usage(a, "assessmentsPerMonth") },
              { key: "students", header: t("plans.metrics.students"), render: (a) => usage(a, "students") },
              { key: "ai", header: t("plans.metrics.aiQuestionsPerMonth"), render: (a) => usage(a, "aiQuestionsPerMonth") },
            ]}
          />
        )}
        {groups.length > 0 && (
          <ResponsiveTable
            caption={t("plans.groups")}
            rows={groups}
            columns={[
              { key: "name", header: t("plans.group"), primary: true, render: (g) => <span dir="auto">{g.name}</span> },
              { key: "plan", header: t("plans.groupPlan"), render: (g) => select(g.plan, (p) => change(`/plans/groups/${g.id}`, p), t("plans.planFor", { name: g.name }), true) },
            ]}
          />
        )}
      </CardBody>
    </Card>
  );
}

export default PlansAdmin;
