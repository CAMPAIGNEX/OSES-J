import { z } from "zod";
import { emailSchema, passwordSchema } from "./common";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: emailSchema,
  password: passwordSchema,
  companyName: z.string().trim().min(2, "Enter your company name").max(160),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
});

export const updateAccountSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  timezone: z.string().max(64).optional(),
});

export const switchOrganizationSchema = z.object({ organizationId: z.string().min(1) });
