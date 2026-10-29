/** Saved structured answers may arrive as JSON text (after a reload). */
export const parseStructured = (value, fallback) => {
  if (typeof value !== "string") return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};
