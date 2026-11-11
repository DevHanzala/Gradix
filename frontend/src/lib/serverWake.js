/**
 * Render's free tier puts the API to sleep after 15 idle minutes; the first request then
 * takes 30-60 seconds (or fails while it starts). This module lets the API client:
 *  - announce "the server is waking up" when a request is slow or the server is unreachable;
 *  - retry such requests automatically (network errors, 502/503/504) for up to ~90 seconds.
 * Listeners (the WakeScreen component) subscribe to the state.
 */
const SLOW_MS = 4000;
export const WAKE_RETRY = { attempts: 12, delayMs: 7500 };

let pending = 0;
let waking = false;
let slowTimer = null;
const listeners = new Set();

const emit = () => listeners.forEach((fn) => fn(waking));
const setWaking = (value) => {
  if (waking === value) return;
  waking = value;
  emit();
};

export const subscribeWake = (fn) => {
  listeners.add(fn);
  fn(waking);
  return () => listeners.delete(fn);
};

export const requestStarted = () => {
  pending += 1;
  if (!slowTimer) slowTimer = setTimeout(() => pending > 0 && setWaking(true), SLOW_MS);
};

export const requestFinished = () => {
  pending = Math.max(0, pending - 1);
  if (pending === 0) {
    clearTimeout(slowTimer);
    slowTimer = null;
    setWaking(false);
  }
};

/** Errors that mean "the server is not up yet", worth retrying. */
export const isWakeError = (error) => !error.response || [502, 503, 504].includes(error.response.status);

export const markWaking = () => setWaking(true);
