import { z } from "zod";
import { idSchema, optionalTrimmed, paginationQuerySchema, platformSchema, searchPlatformSchema } from "./common";

export const DISCOVERY_STRATEGIES = ["auto", "profile_search", "search_engine", "hashtag"] as const;

/** Input accepted by POST /api/leads/search. */
export const searchCriteriaSchema = z
  .object({
    /** Free-text query such as "New apparel brands in New York". */
    query: z.string().trim().min(2, "Describe who you are looking for").max(300),
    keywords: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
    platform: searchPlatformSchema.default("INSTAGRAM"),
    minFollowers: z.coerce.number().int().min(0).max(100_000_000).optional().nullable(),
    maxFollowers: z.coerce.number().int().min(0).max(100_000_000).optional().nullable(),
    country: optionalTrimmed(80),
    region: optionalTrimmed(80),
    city: optionalTrimmed(80),
    category: optionalTrimmed(80),
    limit: z.coerce.number().int().min(1).max(500).default(20),
    strategy: z.enum(DISCOVERY_STRATEGIES).default("auto"),
    filters: z
      .object({
        hasWebsite: z.boolean().optional(),
        hasEmail: z.boolean().optional(),
        hasPhone: z.boolean().optional(),
        hasWhatsApp: z.boolean().optional(),
        activeRecently: z.boolean().optional(),
        postedAfter: z.iso.datetime().optional(),
        postedBefore: z.iso.datetime().optional(),
        businessOnly: z.boolean().optional(),
      })
      .default({}),
    /** Enrich profiles (followers, bio, website) after discovery. */
    enrich: z.boolean().default(true),
    savedSearchId: idSchema.optional(),
  })
  .refine((v) => v.minFollowers == null || v.maxFollowers == null || v.minFollowers <= v.maxFollowers, {
    message: "Minimum followers must be less than or equal to maximum followers",
    path: ["maxFollowers"],
  });
export type SearchCriteriaInput = z.infer<typeof searchCriteriaSchema>;
/** Loose request shape (before defaults are applied); services parse it with the schema. */
export type SearchCriteriaRequest = z.input<typeof searchCriteriaSchema>;

export const leadListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(200).optional(),
  platform: platformSchema.optional(),
  country: z.string().trim().max(80).optional(),
  region: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  minFollowers: z.coerce.number().int().min(0).optional(),
  maxFollowers: z.coerce.number().int().min(0).optional(),
  hasEmail: z.coerce.boolean().optional(),
  hasPhone: z.coerce.boolean().optional(),
  hasWhatsApp: z.coerce.boolean().optional(),
  hasWebsite: z.coerce.boolean().optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  saved: z.coerce.boolean().optional(),
  added: z.coerce.boolean().optional(),
  contacted: z.coerce.boolean().optional(),
  searchRunId: idSchema.optional(),
  tag: z.string().trim().max(60).optional(),
  sort: z.enum(["score", "followers", "newest", "name"]).default("score"),
  order: z.enum(["asc", "desc"]).default("desc"),
});
export type LeadListQuery = z.infer<typeof leadListQuerySchema>;

export const leadIdsSchema = z.object({ leadIds: z.array(idSchema).min(1).max(500) });

export const updateLeadSchema = z.object({
  notes: optionalTrimmed(5000).optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
});

export const savedSearchSchema = z.object({
  name: z.string().trim().min(2).max(120),
  criteria: searchCriteriaSchema,
});

export const exportLeadsSchema = z.object({
  leadIds: z.array(idSchema).max(5000).optional(),
  filters: leadListQuerySchema.partial().optional(),
  scope: z.enum(["selected", "filtered"]).default("selected"),
});
