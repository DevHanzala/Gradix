import { z } from "zod";

/** Same password rule as the server (8+ chars, upper, lower, digit). */
const strongPassword = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a number");

/** Instructor/admin registers a student account. */
export const registerStudentSchema = z
  .object({
    name: z.string().trim().min(2, "Full name is required"),
    email: z.string().trim().email("Enter a valid email address"),
    password: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

/** Enroll an existing student by email. */
export const enrollStudentSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});
