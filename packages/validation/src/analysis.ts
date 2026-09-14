import { z } from "zod";
import { optionalTrimmed, paginationQuerySchema } from "./common";

export const competitorSearchSchema = z.object({
  name: z.string().trim().min(2).max(140).optional(),
  country: optionalTrimmed(80),
  city: optionalTrimmed(80),
  keywords: z.array(z.string().trim().min(1).max(60)).min(1).max(10),
  category: optionalTrimmed(80),
  platform: z.enum(["INSTAGRAM", "FACEBOOK", "BOTH"]).default("INSTAGRAM"),
  dateFrom: z.iso.datetime().optional().nullable(),
  dateTo: z.iso.datetime().optional().nullable(),
  limit: z.coerce.number().int().min(5).max(200).default(30),
});
export type CompetitorSearchInput = z.infer<typeof competitorSearchSchema>;

export const trendSearchSchema = z.object({
  name: z.string().trim().min(2).max(140).optional(),
  country: optionalTrimmed(80),
  city: optionalTrimmed(80),
  productCategory: optionalTrimmed(80),
  keywords: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
  hashtags: z.array(z.string().trim().min(1).max(60).transform((h) => h.replace(/^#/, ""))).max(10).default([]),
  platform: z.enum(["INSTAGRAM", "FACEBOOK", "BOTH"]).default("INSTAGRAM"),
  dateFrom: z.iso.datetime().optional().nullable(),
  dateTo: z.iso.datetime().optional().nullable(),
  limit: z.coerce.number().int().min(10).max(500).default(100),
});
export type TrendSearchInput = z.infer<typeof trendSearchSchema>;

export const analysisListQuerySchema = paginationQuerySchema;
