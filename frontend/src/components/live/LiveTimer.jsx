import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatNumber } from "../../utils/format.js";

/**
 * Countdown to a server deadline. `serverNow` (from the same response) corrects
 * this device's clock, so every screen shows the server's time, not its own.
 */
function LiveTimer({ deadline, serverNow, paused = false, pausedRemainingMs = null, size = "md" }) {
  const { t } = useTranslation();
  const [offset] = useState(() => (serverNow ? new Date(serverNow).getTime() - Date.now() : 0));
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (paused || !deadline) return undefined;
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, [paused, deadline]);

  if (!deadline && pausedRemainingMs === null) return null;
  const remainingMs = paused ? pausedRemainingMs ?? 0 : Math.max(0, new Date(deadline).getTime() - (nowMs + offset));
  const seconds = Math.ceil(remainingMs / 1000);
  const urgent = seconds <= 5;
  const big = size === "lg";

  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={t("live.timeLeft", { seconds })}
      className={`inline-flex items-center justify-center rounded-full font-bold tabular-nums ${
        big ? "h-24 w-24 text-4xl" : "h-14 w-14 text-xl"
      } ${urgent ? "bg-danger-100 text-danger-700" : "bg-primary-50 text-primary-700"}`}
    >
      {formatNumber(seconds)}
    </div>
  );
}

export default LiveTimer;
