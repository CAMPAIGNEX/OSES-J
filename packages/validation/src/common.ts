import { z } from "zod";

export const idSchema = z.string().min(1).max(64);
export const cidSchema = z.string().regex(/^[A-Z]{1,5}-\d{1,12}$/i, "Invalid CID");

export const emailSchema = z.email("Enter a valid email address").max(254).transform((v) => v.trim().toLowerCase());
export const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(200);

export const optionalTrimmed = (max = 500) =>
  z
    .string()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => {
      const t = v?.trim();
      return t ? t : null;
    });

export const optionalUrl = z
  .string()
  .max(2048)
  .optional()
  .nullable()
  .transform((v) => {
    const t = v?.trim();
    return t ? t : null;
  })
  .refine((v) => v === null || /^(https?:\/\/)?[^\s]+\.[^\s]+$/i.test(v), "Enter a valid URL");

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});

export const platformSchema = z.enum(["INSTAGRAM", "FACEBOOK"]);
export const searchPlatformSchema = z.enum(["INSTAGRAM", "FACEBOOK", "BOTH"]);

export const timezoneSchema = z.string().min(1).max(64).refine((tz) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, "Invalid IANA timezone");

export const hhmmSchema = z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24h)");

export const idListSchema = z.object({ ids: z.array(idSchema).min(1).max(500) });

export const dateRangeSchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  preset: z.enum(["today", "week", "month", "3m", "6m", "1y", "custom"]).optional(),
});

export type DateRangeInput = z.infer<typeof dateRangeSchema>;
