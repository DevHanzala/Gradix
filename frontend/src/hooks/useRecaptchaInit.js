// hooks/useRecaptchaInit.js
import { useEffect } from "react";
import { loadRecaptcha } from "../config/captcha";

export default function useRecaptchaInit(siteKey) {
  useEffect(() => {
    if (siteKey) loadRecaptcha(siteKey).catch(console.error);
  }, [siteKey]);
}
