import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/** The join code, link and QR code (generated in the browser; nothing is sent anywhere). */
function JoinInfo({ code, large = false }) {
  const { t } = useTranslation();
  const [qr, setQr] = useState(null);
  const link = `${window.location.origin}/join/${code}`;

  useEffect(() => {
    let cancelled = false;
    import("qrcode")
      .then(({ default: QRCode }) => QRCode.toDataURL(link, { margin: 1, width: large ? 360 : 200 }))
      .then((url) => !cancelled && setQr(url))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [link, large]);

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {qr && <img src={qr} alt={t("live.qrAlt", { code })} className={large ? "h-64 w-64" : "h-36 w-36"} />}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink-muted">{t("live.joinAt")}</p>
        <p className="break-all font-semibold text-primary-700" dir="ltr">
          {window.location.host}/join
        </p>
        <p className="mt-2 text-sm font-semibold text-ink-muted">{t("live.code")}</p>
        <p className={`font-bold tracking-wider text-ink tabular-nums ${large ? "text-6xl tracking-widest" : "text-3xl sm:text-4xl"}`} dir="ltr">
          {code}
        </p>
      </div>
    </div>
  );
}

export default JoinInfo;
