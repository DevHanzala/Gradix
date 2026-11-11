import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaBookOpen, FaCommentDots, FaQuestionCircle, FaRoute } from "react-icons/fa";
import apiClient from "../../lib/apiClient.js";
import usePreferences from "../../store/preferencesStore.js";
import { errorMessage } from "../../utils/forms.js";
import { Alert, Button, Checkbox, Modal, Textarea } from "../ui";
import { TOUR_EVENT } from "./tourEvents.js";


/** Top-bar help menu: help center, replay the tour, feedback, display preferences. */
function HelpMenu() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [state, setState] = useState({ busy: false, error: null, sent: false });
  const { lowData, dyslexiaFont, setPreference } = usePreferences();
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (e.key === "Escape" || (e.type === "mousedown" && ref.current && !ref.current.contains(e.target))) setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("mousedown", close);
    };
  }, [open]);

  const send = async () => {
    setState({ busy: true, error: null, sent: false });
    try {
      await apiClient.post("/feedback", { message, page: location.pathname, language: i18n.language });
      setState({ busy: false, error: null, sent: true });
      setMessage("");
    } catch (e) {
      setState({ busy: false, error: errorMessage(e, t("help.feedbackFailed")), sent: false });
    }
  };

  const item = "flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-start text-sm text-ink hover:bg-gray-100";
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t("help.menu")}
        className="inline-flex h-11 w-11 items-center justify-center rounded-control text-ink-muted hover:bg-gray-100"
      >
        <FaQuestionCircle aria-hidden="true" className="text-lg" />
      </button>
      {open && (
        <div className="absolute end-0 z-30 mt-2 w-72 rounded-card border border-line bg-surface p-2 shadow-lg">
          <Link to="/help" className={item} onClick={() => setOpen(false)}>
            <FaBookOpen aria-hidden="true" /> {t("help.center")}
          </Link>
          <button
            type="button"
            className={item}
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new Event(TOUR_EVENT));
            }}
          >
            <FaRoute aria-hidden="true" /> {t("help.replayTour")}
          </button>
          <button
            type="button"
            className={item}
            onClick={() => {
              setOpen(false);
              setState({ busy: false, error: null, sent: false });
              setFeedbackOpen(true);
            }}
          >
            <FaCommentDots aria-hidden="true" /> {t("help.sendFeedback")}
          </button>
          <div className="mt-2 border-t border-line pt-2">
            <Checkbox label={t("help.lowData")} description={t("help.lowDataHint")} checked={lowData} onChange={(e) => setPreference("lowData", e.target.checked)} />
            <Checkbox label={t("help.dyslexiaFont")} description={t("help.dyslexiaFontHint")} checked={dyslexiaFont} onChange={(e) => setPreference("dyslexiaFont", e.target.checked)} />
          </div>
        </div>
      )}
      <Modal
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        title={t("help.sendFeedback")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFeedbackOpen(false)}>
              {t("common.close")}
            </Button>
            <Button onClick={send} loading={state.busy} disabled={message.trim().length < 3 || state.sent}>
              {t("help.send")}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Textarea label={t("help.feedbackLabel")} hint={t("help.feedbackHint")} value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={4000} />
          {state.error && <Alert tone="danger">{state.error}</Alert>}
          {state.sent && <Alert tone="success">{t("help.feedbackThanks")}</Alert>}
        </div>
      </Modal>
    </div>
  );
}

export default HelpMenu;
