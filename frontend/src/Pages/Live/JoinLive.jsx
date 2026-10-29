import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaSignInAlt } from "react-icons/fa";
import useAuthStore from "../../store/authStore.js";
import { joinLiveApi, lookupLiveCodeApi } from "../../api/live.api.js";
import { saveLiveToken } from "../../utils/liveTokens.js";
import { errorMessage } from "../../utils/forms.js";
import LanguageSwitcher from "../../components/LanguageSwitcher.jsx";
import { Alert, Button, Card, CardBody, Input } from "../../components/ui";
import { BRAND } from "../../layouts/navigation.js";

/**
 * Join a live session with its 6-digit code. Signed-in users join with their
 * account; everyone else joins as a guest with a nickname (live sessions only).
 */
function JoinLive() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { code: codeParam } = useParams();
  const user = useAuthStore((s) => s.user);
  const [code, setCode] = useState(codeParam || "");
  const [nickname, setNickname] = useState("");
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const cleanCode = code.replace(/\D/g, "").slice(0, 6);

  useEffect(() => {
    setInfo(null);
    if (cleanCode.length !== 6) return undefined;
    let cancelled = false;
    lookupLiveCodeApi(cleanCode)
      .then((res) => !cancelled && (setInfo(res.data.data), setError(null)))
      .catch((e) => !cancelled && setError(errorMessage(e, t("live.codeUnknown"))));
    return () => {
      cancelled = true;
    };
  }, [cleanCode, t]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await joinLiveApi(cleanCode, nickname.trim());
      const { token, session } = res.data.data;
      saveLiveToken(session.id, token);
      navigate(`/live/${session.id}`);
    } catch (err) {
      setError(errorMessage(err, t("live.joinFailed")));
    } finally {
      setBusy(false);
    }
  };

  const needsNickname = !user && !info?.anonymousNames;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="inline-flex items-center gap-2 text-lg font-bold text-primary-700">
          <BRAND.icon aria-hidden="true" />
          {BRAND.name}
        </span>
        <LanguageSwitcher />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center">
        <Card className="w-full max-w-md">
          <CardBody>
            <h1 className="text-2xl font-bold text-ink">{t("live.joinTitle")}</h1>
            <p className="mt-1 text-ink-muted">{t("live.joinSubtitle")}</p>
            <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
              <Input
                label={t("live.code")}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                dir="ltr"
                className="text-center"
                required
              />
              {info && (
                <Alert tone="info" title={info.title}>
                  {info.status === "lobby" ? t("live.notStartedYet") : t("live.inProgress")}
                </Alert>
              )}
              {user ? (
                <p className="text-sm text-ink-muted">{t("live.joiningAs", { name: user.name })}</p>
              ) : needsNickname ? (
                <Input
                  label={t("live.nickname")}
                  hint={t("live.nicknameHint")}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={30}
                  autoComplete="nickname"
                  required
                />
              ) : (
                <p className="text-sm text-ink-muted">{t("live.anonymousNames")}</p>
              )}
              {error && <Alert tone="danger">{error}</Alert>}
              <Button
                type="submit"
                size="lg"
                fullWidth
                icon={FaSignInAlt}
                loading={busy}
                disabled={cleanCode.length !== 6 || (needsNickname && !nickname.trim())}
              >
                {t("live.join")}
              </Button>
            </form>
            {!user && <p className="mt-4 text-xs text-ink-subtle">{t("live.guestNote")}</p>}
          </CardBody>
        </Card>
      </main>
    </div>
  );
}

export default JoinLive;
