import { useTranslation } from "react-i18next";
import { FaBalanceScale, FaChartLine, FaFileUpload, FaGlobeAsia, FaPrint, FaRandom, FaShieldAlt } from "react-icons/fa";
import useAuthStore from "../store/authStore.js";
import { dashboardPathForRole } from "../utils/redirectByRole.js";
import { Button } from "../components/ui";

// Only features that exist today are listed here.
const FEATURES = [
  { icon: FaRandom, key: "unique" },
  { icon: FaChartLine, key: "adaptive" },
  { icon: FaGlobeAsia, key: "languages" },
  { icon: FaFileUpload, key: "sources" },
  { icon: FaBalanceScale, key: "marking" },
  { icon: FaPrint, key: "papers" },
  { icon: FaShieldAlt, key: "fair" },
];

function Home() {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  return (
    <>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
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
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="features-heading" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 id="features-heading" className="text-2xl font-bold text-ink">
          {t("home.featuresTitle")}
        </h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <li key={f.key} className="rounded-card bg-surface p-5 shadow-card">
                <span className="flex h-11 w-11 items-center justify-center rounded-control bg-primary-50 text-primary-600">
                  <Icon aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold text-ink">{t(`home.features.${f.key}.title`)}</h3>
                <p className="mt-1 text-sm text-ink-muted">{t(`home.features.${f.key}.text`)}</p>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

export default Home;
