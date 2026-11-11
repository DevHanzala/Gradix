import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FaBalanceScale,
  FaBroadcastTower,
  FaChartLine,
  FaFileUpload,
  FaGlobeAsia,
  FaPrint,
  FaRandom,
  FaShieldAlt,
  FaUserShield,
} from "react-icons/fa";
import useAuthStore from "../store/authStore.js";
import apiClient from "../lib/apiClient.js";
import { dashboardPathForRole } from "../utils/redirectByRole.js";
import { errorMessage } from "../utils/forms.js";
import { formatNumber } from "../utils/format.js";
import { Alert, Button, Input, Textarea } from "../components/ui";

// Only features that exist today are listed here.
const FEATURES = [
  { icon: FaUserShield, key: "integrity" },
  { icon: FaRandom, key: "unique" },
  { icon: FaChartLine, key: "adaptive" },
  { icon: FaGlobeAsia, key: "languages" },
  { icon: FaBroadcastTower, key: "live" },
  { icon: FaFileUpload, key: "sources" },
  { icon: FaBalanceScale, key: "marking" },
  { icon: FaPrint, key: "papers" },
  { icon: FaShieldAlt, key: "fair" },
];
const LIMITS = ["assessmentsPerMonth", "students", "aiQuestionsPerMonth", "liveSessionSize"];

/** Public landing page: what Gradix is, features, plans and a contact form. */
function Home() {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const [plans, setPlans] = useState([]);
  const [contact, setContact] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState({ busy: false, ok: false, error: null });

  useEffect(() => {
    apiClient
      .get("/plans")
      .then((res) => setPlans(res.data.data))
      .catch(() => setPlans([]));
  }, []);

  const send = async (e) => {
    e.preventDefault();
    setSent({ busy: true, ok: false, error: null });
    try {
      await apiClient.post("/feedback", { kind: "contact", ...contact, page: "/", language: i18n.language });
      setSent({ busy: false, ok: true, error: null });
      setContact({ name: "", email: "", message: "" });
    } catch (err) {
      setSent({ busy: false, ok: false, error: errorMessage(err, t("home.contact.failed")) });
    }
  };

  return (
    <>
      <section className="border-b border-line bg-surface">
        <div className="w-full px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">{t("home.eyebrow")}</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-5xl">{t("home.title")}</h1>
            <p className="mt-4 text-lg text-ink-muted">{t("home.lead")}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {user ? (
                <Button to={dashboardPathForRole(user.role)} size="lg">
                  {t("nav.goToMyDashboard")}
                </Button>
              ) : (
                <>
                  <Button to="/signup" size="lg">
                    {t("home.createAccount")}
                  </Button>
                  <Button to="/login" size="lg" variant="secondary">
                    {t("auth.login")}
                  </Button>
                </>
              )}
              <Button to="/join" size="lg" variant="ghost" icon={FaBroadcastTower}>
                {t("nav.joinLive")}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="features-heading" className="w-full px-4 py-14 sm:px-6 lg:px-8">
        <h2 id="features-heading" className="text-2xl font-bold text-ink">
          {t("home.featuresTitle")}
        </h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <li key={f.key} className="rounded-card bg-surface p-5 shadow-card">
                <span className="flex h-11 w-11 items-center justify-center rounded-control bg-primary-50 text-primary-600" data-decorative>
                  <Icon aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold text-ink">{t(`home.features.${f.key}.title`)}</h3>
                <p className="mt-1 text-sm text-ink-muted">{t(`home.features.${f.key}.text`)}</p>
              </li>
            );
          })}
        </ul>
      </section>

      {plans.length > 0 && (
        <section aria-labelledby="plans-heading" className="w-full border-t border-line bg-surface px-4 py-14 sm:px-6 lg:px-8">
          <h2 id="plans-heading" className="text-2xl font-bold text-ink">
            {t("home.plansTitle")}
          </h2>
          <p className="mt-2 text-ink-muted">{t("home.plansLead")}</p>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {plans.map((p) => (
              <li key={p.id} className={`rounded-card border-2 p-6 ${p.id === "pro" ? "border-primary-600" : "border-line"}`}>
                <h3 className="text-xl font-bold text-ink">{t(`plans.names.${p.id}`)}</h3>
                <p className="mt-1 text-sm text-ink-muted">{t(`plans.audience.${p.id}`)}</p>
                <p className="mt-4 text-3xl font-bold text-ink">
                  {p.pricePkr === 0 ? t("plans.free") : t("plans.pricePerMonth", { price: formatNumber(p.pricePkr) })}
                </p>
                <ul className="mt-4 space-y-1 text-sm text-ink">
                  {LIMITS.map((m) => (
                    <li key={m}>
                      • {t(`plans.metrics.${m}`)}: {p.limits[m] === null ? t("plans.unlimited") : formatNumber(p.limits[m])}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="contact-heading" className="w-full px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-xl">
          <h2 id="contact-heading" className="text-2xl font-bold text-ink">
            {t("home.contact.title")}
          </h2>
          <p className="mt-2 text-ink-muted">{t("home.contact.lead")}</p>
          <form onSubmit={send} className="mt-6 space-y-4">
            <Input label={t("home.contact.name")} value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} maxLength={120} autoComplete="name" />
            <Input label={t("home.contact.email")} type="email" required value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} autoComplete="email" dir="ltr" />
            <Textarea label={t("home.contact.message")} required rows={4} value={contact.message} onChange={(e) => setContact((c) => ({ ...c, message: e.target.value }))} maxLength={4000} />
            {sent.error && <Alert tone="danger">{sent.error}</Alert>}
            {sent.ok && <Alert tone="success">{t("home.contact.thanks")}</Alert>}
            <Button type="submit" loading={sent.busy} disabled={!contact.email || contact.message.trim().length < 3}>
              {t("home.contact.send")}
            </Button>
          </form>
        </div>
      </section>
    </>
  );
}

export default Home;
