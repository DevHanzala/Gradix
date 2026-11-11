import { create } from "zustand";

/**
 * Per-device display preferences (kept in this browser only):
 *  - lowData: fewer animations, lazy images, no decorative extras (for slow connections);
 *  - dyslexiaFont: a plainer Latin font with wider letter, word and line spacing.
 * Applied as classes on <html>, so CSS does the rest.
 */
const KEY = "gradix.preferences";
const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
};
const apply = (prefs) => {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("low-data", Boolean(prefs.lowData));
  document.documentElement.classList.toggle("dyslexia-font", Boolean(prefs.dyslexiaFont));
};

const initial = { lowData: false, dyslexiaFont: false, lowDataSuggestionDismissed: false, ...read() };
apply(initial);

const usePreferences = create((set, get) => ({
  ...initial,
  setPreference: (key, value) => {
    set({ [key]: value });
    const { lowData, dyslexiaFont, lowDataSuggestionDismissed } = get();
    const prefs = { lowData, dyslexiaFont, lowDataSuggestionDismissed };
    apply(prefs);
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      // Private mode: the choice lasts for this page.
    }
  },
}));

/** True when the browser reports a slow or data-saving connection. */
export const slowConnection = () => {
  const c = typeof navigator !== "undefined" ? navigator.connection : null;
  return Boolean(c && (c.saveData || ["slow-2g", "2g"].includes(c.effectiveType)));
};

export default usePreferences;
