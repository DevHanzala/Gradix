import { z } from "zod";

// Messages are i18n keys; utils/forms.js translates them.

/** Same password rule as the server (8+ chars, upper, lower, digit). */
const strongPassword = z
  .string()
  .min(8, "validation.passwordMin")
  .regex(/[a-z]/, "validation.passwordLower")
  .regex(/[A-Z]/, "validation.passwordUpper")
  .regex(/[0-9]/, "validation.passwordNumber");

/** Instructor/admin registers a student account. */
export const registerStudentSchema = z
  .object({
    name: z.string().trim().min(2, "validation.fullNameRequired"),
    email: z.string().trim().email("validation.emailInvalid"),
    password: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "validation.passwordsMismatch",
  });

/** Enroll an existing student by email. */
export const enrollStudentSchema = z.object({
  email: z.string().trim().email("validation.emailInvalid"),
});
