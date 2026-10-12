/**
 * Run a zod schema and return { data, errors } where `errors` maps each field
 * to its first message (or is null when the input is valid).
 */
export const validateWith = (schema, values) => {
  const result = schema.safeParse(values);
  if (result.success) return { data: result.data, errors: null };
  const errors = {};
  for (const issue of result.error.issues) {
    const key = issue.path?.[0] ?? "_form";
    if (!errors[key]) errors[key] = issue.message;
  }
  return { data: null, errors };
};

/** Message from an API error, a store-rethrown API body or a plain Error. */
export const errorMessage = (error, fallback = "Something went wrong. Please try again.") =>
  error?.response?.data?.message || error?.message || fallback;
