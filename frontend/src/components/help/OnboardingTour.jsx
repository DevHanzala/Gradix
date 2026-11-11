import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Modal } from "../ui";
import { TOUR_EVENT } from "./tourEvents.js";

/** Steps per role; texts live in help.json under tour.<role>.<n>. */
const STEPS = { instructor: 6, student: 5, admin: 3, super_admin: 4 };
const seenKey = (userId) => `gradix.tour.${userId}`;

/**
 * First-login tour per role: a few short steps, skippable, replayable from the help menu.
 * "Seen" is remembered per user in this browser.
 */
function OnboardingTour({ user }) {
  const { t } = useTranslation();
  const role = STEPS[user?.role] ? user.role : null;
  const [step, setStep] = useState(null);

  useEffect(() => {
    if (!role || !user?.id) return undefined;
    let seen = true;
    try {
      seen = localStorage.getItem(seenKey(user.id)) === "1";
    } catch {
      seen = true;
    }
    if (!seen) setStep(0);
    const replay = () => setStep(0);
    window.addEventListener(TOUR_EVENT, replay);
    return () => window.removeEventListener(TOUR_EVENT, replay);
  }, [role, user?.id]);

  if (!role || step === null) return null;
  const total = STEPS[role];
  const finish = () => {
    try {
      localStorage.setItem(seenKey(user.id), "1");
    } catch {
      // ignore
    }
    setStep(null);
  };

  return (
    <Modal
      isOpen
      onClose={finish}
      title={t(`help.tour.${role}.${step + 1}.title`)}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-ink-muted">{t("help.tourStep", { n: step + 1, total })}</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={finish}>
              {t("help.skipTour")}
            </Button>
            {step > 0 && (
              <Button variant="secondary" onClick={() => setStep(step - 1)}>
                {t("common.back")}
              </Button>
            )}
            {step + 1 < total ? <Button onClick={() => setStep(step + 1)}>{t("common.next")}</Button> : <Button onClick={finish}>{t("help.finishTour")}</Button>}
          </div>
        </div>
      }
    >
      <p className="leading-relaxed text-ink">{t(`help.tour.${role}.${step + 1}.body`)}</p>
    </Modal>
  );
}

export default OnboardingTour;
