import { z } from "zod";

// Messages are i18n keys; utils/forms.js validateWith translates them.

const strongPassword = z
  .string()
  .min(8, "validation.passwordMin")
  .regex(/[a-z]/, "validation.passwordLower")
  .regex(/[A-Z]/, "validation.passwordUpper")
  .regex(/[0-9]/, "validation.passwordNumber");

/** Forgot / reset password (email only) */
export const resetPasswordSchema = z.object({
  email: z.string().min(1, "validation.emailRequired").email("validation.emailInvalid"),
});

/** Set new password */
export const setNewPasswordSchema = z
  .object({
    newPassword: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "validation.passwordsMismatch",
  });

/** Change password while logged in */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "validation.currentPasswordRequired"),
    newPassword: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "validation.passwordsMismatch",
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    path: ["newPassword"],
    message: "validation.passwordSame",
  });
