import { z } from "zod";

// Messages are i18n keys; utils/forms.js validateWith translates them.

export const loginSchema = z.object({
  email: z.string().email("validation.emailInvalid"),
  password: z.string().min(1, "validation.passwordRequired"),
});

export const signupSchema = z.object({
  name: z.string().min(2, "validation.nameMin").max(50, "validation.nameMax"),
  email: z.string().email("validation.emailInvalid"),
  password: z.string().min(8, "validation.passwordMin").regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "validation.passwordMix"),
});
