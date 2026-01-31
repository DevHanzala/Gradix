import { z } from "zod";

/**
 * Register + optional enroll
 */
export const registerStudentSchema = z
  .object({
    name: z.string().min(1, "Full name is required"),
    email: z.string().email("Valid email is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

/**
 * Enroll existing student
 */
export const enrollStudentSchema = z.object({
  email: z.string().email("Valid email is required"),
});
