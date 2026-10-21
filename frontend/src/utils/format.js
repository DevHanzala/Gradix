import i18n from "../i18n/index.js";
import { LOCALES } from "./languages.js";

/** Locale-aware formatting (Intl) in the UI language, or in `lang` when given (e.g. an exam's language). */
const locale = (lang) => LOCALES[lang || i18n.language] || "en-GB";

export const formatNumber = (value, options, lang) =>
  value === null || value === undefined || Number.isNaN(Number(value)) ? "–" : new Intl.NumberFormat(locale(lang), options).format(Number(value));

/** 87.5 -> "87.5%" (or the locale's equivalent). Input is a percentage, not a fraction. */
export const formatPercent = (value, digits = 1, lang) =>
  value === null || value === undefined ? "–" : formatNumber(Number(value) / 100, { style: "percent", maximumFractionDigits: digits }, lang);

export const formatDate = (value, options = { dateStyle: "medium" }) => {
  if (!value) return "–";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "–" : new Intl.DateTimeFormat(locale(), options).format(date);
};

export const formatDateTime = (value) => formatDate(value, { dateStyle: "medium", timeStyle: "short" });

/** Seconds -> "12 min 5 s" style text in the UI language. */
export const formatDuration = (seconds, lang) => {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  const unit = (value, name) => new Intl.NumberFormat(locale(lang), { style: "unit", unit: name, unitDisplay: "short" }).format(value);
  if (minutes === 0) return unit(secs, "second");
  return secs ? `${unit(minutes, "minute")} ${unit(secs, "second")}` : unit(minutes, "minute");
};

/** Countdown "m:ss" with Latin digits (timers stay readable and stable in every script). */
export const formatClock = (seconds) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
