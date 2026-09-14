import { z } from "zod";

/** OS-Panel (platform operators) request schemas. */

export const osListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
  type: z.string().trim().max(60).optional(),
  organizationId: z.string().trim().max(36).optional(),
  action: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(25),
});
export type OsListQuery = z.infer<typeof osListQuerySchema>;

export const osOrganizationUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
    suspendedReason: z.string().trim().max(300).nullable().optional(),
    plan: z.string().trim().min(2).max(40).optional(),
    internalNotes: z.string().trim().max(5000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });
export type OsOrganizationUpdate = z.infer<typeof osOrganizationUpdateSchema>;

export const osUserUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    isActive: z.boolean().optional(),
    isSuperAdmin: z.boolean().optional(),
    newPassword: z.string().min(10).max(200).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });
export type OsUserUpdate = z.infer<typeof osUserUpdateSchema>;

export const osMembershipSchema = z.object({
  organizationId: z.string().min(1),
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]).default("MEMBER"),
});
