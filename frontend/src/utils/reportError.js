import toast from "react-hot-toast";

/**
 * Standard handling for a failed request or action:
 * logs details in development and shows a toast (unless `silent`).
 * Returns the message so callers can also show it inline.
 *
 * Accepts axios errors, API bodies rethrown by stores ({ code, message })
 * and plain Errors.
 */
export const reportError = (error, fallback = "Something went wrong.", { silent = false } = {}) => {
  const message = error?.response?.data?.message || error?.message || fallback;
  if (import.meta.env.DEV) {
    console.error(fallback, error);
  }
  if (!silent) toast.error(message);
  return message;
};
