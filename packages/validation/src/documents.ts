import { z } from "zod";
import { idSchema, paginationQuerySchema } from "./common";

export const DOCUMENT_KINDS = ["CATALOG", "PRICE_LIST", "COMPANY_PROFILE", "MOQ_SHEET", "SIZE_CHART", "PRODUCTION_INFO", "KNOWLEDGE", "EXPORT", "OTHER"] as const;

export const documentMetaSchema = z.object({
  kind: z.enum(DOCUMENT_KINDS).default("OTHER"),
  clientId: idSchema.optional().nullable(),
  conversationId: idSchema.optional().nullable(),
  campaignId: idSchema.optional().nullable(),
  addToKnowledge: z.boolean().default(false),
  title: z.string().trim().max(200).optional(),
});

export const documentListQuerySchema = paginationQuerySchema.extend({
  kind: z.enum(DOCUMENT_KINDS).optional(),
  clientId: idSchema.optional(),
  q: z.string().max(200).optional(),
});

export const trashListQuerySchema = paginationQuerySchema.extend({
  entityType: z.enum(["CLIENT", "DOCUMENT", "LEAD", "CAMPAIGN", "NOTE", "CONVERSATION", "SAVED_SEARCH"]).optional(),
});
