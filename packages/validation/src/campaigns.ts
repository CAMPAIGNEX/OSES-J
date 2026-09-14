import { z } from "zod";
import { hhmmSchema, idSchema, paginationQuerySchema, platformSchema, timezoneSchema } from "./common";

export const followUpStepSchema = z.object({
  dayOffset: z.number().int().min(1).max(90),
  /** Optional template; when omitted the AI generates the follow-up. */
  template: z.string().max(4000).optional().nullable(),
});

export const createCampaignSchema = z.object({
  name: z.string().trim().min(2).max(140),
  channel: platformSchema.default("INSTAGRAM"),
  audienceType: z.enum(["CLIENTS", "SAVED_LEADS", "TAG"]).default("CLIENTS"),
  audienceFilter: z
    .object({
      clientIds: z.array(idSchema).max(1000).optional(),
      leadIds: z.array(idSchema).max(1000).optional(),
      tag: z.string().max(60).optional(),
      country: z.string().max(80).optional(),
      status: z.string().max(40).optional(),
    })
    .default({}),
  firstMessageMode: z.enum(["AI", "TEMPLATE"]).default("AI"),
  template: z.string().max(4000).optional().nullable(),
  followUps: z.array(followUpStepSchema).max(6).default([{ dayOffset: 3 }, { dayOffset: 7 }]),
  workingHours: z
    .object({
      enabled: z.boolean().default(true),
      start: hhmmSchema.default("10:00"),
      end: hhmmSchema.default("17:00"),
      days: z.array(z.number().int().min(0).max(6)).optional(),
    })
    .default({ enabled: true, start: "10:00", end: "17:00" }),
  timezoneMode: z.enum(["client", "exporter", "custom"]).default("client"),
  customTimezone: timezoneSchema.optional().nullable(),
  messagesPerDay: z.number().int().min(1).max(500).default(30),
  startAt: z.iso.datetime().optional().nullable(),
  requireApproval: z.boolean().default(true),
});
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const updateCampaignSchema = createCampaignSchema.partial();

export const campaignActionSchema = z.object({ action: z.enum(["start", "pause", "resume", "cancel", "complete"]) });

export const campaignListQuerySchema = paginationQuerySchema.extend({
  status: z.string().max(40).optional(),
});
