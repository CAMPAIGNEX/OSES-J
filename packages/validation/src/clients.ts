import { z } from "zod";
import { idSchema, optionalTrimmed, optionalUrl, paginationQuerySchema } from "./common";

export const CLIENT_STATUS_VALUES = [
  "NEW",
  "CONTACTED",
  "REPLIED",
  "INTERESTED",
  "NEGOTIATING",
  "CUSTOMER",
  "NOT_INTERESTED",
  "DO_NOT_CONTACT",
  "ARCHIVED",
] as const;

export const clientListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(200).optional(),
  status: z.enum(CLIENT_STATUS_VALUES).optional(),
  country: z.string().trim().max(80).optional(),
  tag: z.string().trim().max(60).optional(),
  platform: z.enum(["INSTAGRAM", "FACEBOOK"]).optional(),
  sort: z.enum(["newest", "name", "score", "activity", "cid"]).default("newest"),
  order: z.enum(["asc", "desc"]).default("desc"),
});
export type ClientListQuery = z.infer<typeof clientListQuerySchema>;

export const addToBusinessSchema = z.object({ leadIds: z.array(idSchema).min(1).max(200) });

export const createClientSchema = z.object({
  brandName: z.string().trim().min(1).max(160),
  companyName: optionalTrimmed(160),
  category: optionalTrimmed(80),
  website: optionalUrl,
  email: optionalTrimmed(254),
  phone: optionalTrimmed(40),
  whatsapp: optionalTrimmed(40),
  country: optionalTrimmed(80),
  region: optionalTrimmed(80),
  city: optionalTrimmed(80),
  address: optionalTrimmed(300),
  instagramUsername: optionalTrimmed(64),
  facebookUrl: optionalUrl,
  notes: optionalTrimmed(5000),
});
export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = createClientSchema.partial().extend({
  status: z.enum(CLIENT_STATUS_VALUES).optional(),
  doNotContact: z.boolean().optional(),
  timezone: z.string().max(64).optional().nullable(),
  ownerUserId: idSchema.optional().nullable(),
});
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export const noteSchema = z.object({ body: z.string().trim().min(1).max(10_000) });

export const tagsSchema = z.object({ tags: z.array(z.string().trim().min(1).max(60)).max(30) });

export const createTagSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
