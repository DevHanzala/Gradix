import { useTranslation } from "react-i18next";

const SECTIONS = { terms: 8, privacy: 9 };

/** Terms of Service and Privacy Policy (doc = "terms" | "privacy"); text in legal.json. */
function Legal({ doc }) {
  const { t, i18n } = useTranslation();
  const keys = Array.from({ length: SECTIONS[doc] }, (_, i) => `legal.${doc}.s${i + 1}`).filter((k) => i18n.exists(`${k}.title`));
  return (
    <article className="w-full px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold text-ink">{t(`legal.${doc}.title`)}</h1>
        <p className="mt-2 text-sm text-ink-muted">{t("legal.updated")}</p>
        <p className="mt-6 leading-relaxed text-ink">{t(`legal.${doc}.intro`)}</p>
        {keys.map((k) => (
          <section key={k} className="mt-8">
            <h2 className="text-xl font-semibold text-ink">{t(`${k}.title`)}</h2>
            <p className="mt-2 leading-relaxed text-ink-muted">{t(`${k}.body`)}</p>
          </section>
        ))}
      </div>
    </article>
  );
}

export default Legal;
