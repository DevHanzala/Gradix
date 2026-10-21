import toast from "react-hot-toast";
import { errorMessage } from "./forms.js";

/**
 * Standard handling for a failed request or action:
 * logs details in development and shows a toast (unless `silent`).
 * Returns the message so callers can also show it inline.
 *
 * Accepts axios errors, API bodies rethrown by stores ({ code, message })
 * and plain Errors.
 */
export const reportError = (error, fallback, { silent = false } = {}) => {
  const message = errorMessage(error, fallback);
  if (import.meta.env.DEV) {
    console.error(fallback, error);
  }
  if (!silent) toast.error(message);
  return message;
};
