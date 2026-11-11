import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { subscribeWake } from "../lib/serverWake.js";
import Spinner from "./ui/Spinner.jsx";

/** A friendly overlay while the free-tier server wakes up; requests retry by themselves. */
function WakeScreen() {
  const { t } = useTranslation();
  const [waking, setWaking] = useState(false);
  useEffect(() => subscribeWake(setWaking), []);
  if (!waking) return null;
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-0 top-0 z-50 flex justify-center p-3">
      <div className="flex max-w-lg items-center gap-3 rounded-card border border-primary-100 bg-surface px-4 py-3 shadow-lg">
        <Spinner size="sm" />
        <div>
          <p className="font-semibold text-ink">{t("common.wakingTitle")}</p>
          <p className="text-sm text-ink-muted">{t("common.wakingBody")}</p>
        </div>
      </div>
    </div>
  );
}

export default WakeScreen;
