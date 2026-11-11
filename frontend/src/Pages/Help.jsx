import { useTranslation } from "react-i18next";
import { FaRoute } from "react-icons/fa";
import useAuthStore from "../store/authStore.js";
import { TOUR_EVENT } from "../components/help/tourEvents.js";
import { Button, Card, CardBody, CardHeader, PageHeader } from "../components/ui";

const GUIDES = ["instructor", "student", "admin"];
const MAX_STEPS = 12;

/** Help center: short step-by-step guides per role (your own role first). */
function Help() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const mine = user?.role === "super_admin" ? "admin" : user?.role;
  const order = [mine, ...GUIDES.filter((g) => g !== mine)].filter(Boolean);
  const steps = (role) => Array.from({ length: MAX_STEPS }, (_, i) => `help.guides.${role}.s${i + 1}`).filter((k) => i18n.exists(k));

  return (
    <>
      <PageHeader
        title={t("help.center")}
        description={t("help.centerDescription")}
        actions={
          user && (
            <Button variant="secondary" icon={FaRoute} onClick={() => window.dispatchEvent(new Event(TOUR_EVENT))}>
              {t("help.replayTour")}
            </Button>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        {order.map((role) => (
          <Card key={role}>
            <CardHeader title={t(`help.guides.${role}.title`)} />
            <CardBody>
              <ol className="list-decimal space-y-2 ps-5 text-ink">
                {steps(role).map((key) => (
                  <li key={key}>{t(key)}</li>
                ))}
              </ol>
            </CardBody>
          </Card>
        ))}
        <Card>
          <CardHeader title={t("help.keyboardTitle")} />
          <CardBody>
            <ul className="list-disc space-y-2 ps-5 text-ink">
              <li>{t("help.keyboard.options")}</li>
              <li>{t("help.keyboard.tab")}</li>
              <li>{t("help.keyboard.readAloud")}</li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

export default Help;
