// Hebrew, Arabic, Syriac, Thaana… plus Arabic presentation forms (A and B).
const RTL_CHARACTERS = /[֐-ࣿיִ-﷿ﹰ-ﻼ]/;

/** "rtl" when the text contains right-to-left script, otherwise "ltr". */
export const textDirection = (text) => (RTL_CHARACTERS.test(String(text || "")) ? "rtl" : "ltr");
