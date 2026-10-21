import { useId } from "react";
import { useTranslation } from "react-i18next";
import { FaGlobe } from "react-icons/fa";
import useAuthStore from "../store/authStore.js";
import { LANGUAGES } from "../utils/languages.js";

/**
 * UI language selector. Language names are shown in their own script so a
 * user can always find theirs. Signed-in users' choice is saved to their account.
 */
function LanguageSwitcher({ compact = false, className = "" }) {
  const { t, i18n } = useTranslation();
  const setLanguage = useAuthStore((s) => s.setLanguage);
  const id = useId();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label htmlFor={id} className={compact ? "sr-only" : "text-sm font-semibold text-ink"}>
        {t("common.language")}
      </label>
      {compact && <FaGlobe aria-hidden="true" className="text-ink-subtle" />}
      <select
        id={id}
        value={i18n.language}
        onChange={(e) => setLanguage(e.target.value)}
        className="min-h-11 rounded-control border border-line-strong bg-surface px-2 text-sm text-ink focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default LanguageSwitcher;
