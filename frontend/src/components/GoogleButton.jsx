import { FaGoogle } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import Button from "./ui/Button.jsx";

function GoogleButton({ loading, onClick, children }) {
  const { t } = useTranslation();
  return (
    <Button variant="secondary" fullWidth icon={FaGoogle} loading={loading} onClick={onClick}>
      {children || t("auth.continueWithGoogle")}
    </Button>
  );
}

export function OrDivider() {
  const { t } = useTranslation();
  return (
    <div className="my-6 flex items-center gap-3 text-xs font-medium uppercase text-ink-subtle" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      {t("common.or")}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export default GoogleButton;
