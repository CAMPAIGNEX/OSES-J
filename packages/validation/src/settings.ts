import { z } from "zod";
import { hhmmSchema, optionalTrimmed, optionalUrl, timezoneSchema } from "./common";

export const companySettingsSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: optionalTrimmed(4000),
  website: optionalUrl,
  country: optionalTrimmed(80),
  city: optionalTrimmed(80),
  address: optionalTrimmed(300),
  products: optionalTrimmed(4000),
  moq: optionalTrimmed(300),
  certifications: optionalTrimmed(1000),
  shippingInfo: optionalTrimmed(2000),
  productionCapacity: optionalTrimmed(500),
  contactEmail: optionalTrimmed(254),
  contactPhone: optionalTrimmed(40),
  timezone: timezoneSchema.optional(),
});
export type CompanySettingsInput = z.infer<typeof companySettingsSchema>;

export const workingHoursSchema = z.object({
  enabled: z.boolean(),
  start: hhmmSchema,
  end: hhmmSchema,
  days: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  timezoneMode: z.enum(["client", "exporter", "custom"]).default("client"),
  customTimezone: timezoneSchema.optional().nullable(),
});

export const messagingSettingsSchema = z.object({
  defaultChannel: z.enum(["INSTAGRAM", "FACEBOOK"]).optional(),
  messagingMode: z.enum(["MANUAL", "COPILOT", "AUTOPILOT"]).optional(),
  workingHours: workingHoursSchema.optional(),
  followUpDays: z.array(z.number().int().min(1).max(90)).max(6).optional(),
  messagesPerHour: z.number().int().min(1).max(500).optional(),
  messagesPerDay: z.number().int().min(1).max(5000).optional(),
  minMinutesBetweenMessages: z.number().int().min(0).max(1440).optional(),
});
export type MessagingSettingsInput = z.infer<typeof messagingSettingsSchema>;

export const aiSettingsSchema = z.object({
  provider: z.enum(["anthropic", "openai", "openai_compatible", "platform_default", "none"]).optional(),
  model: z.string().trim().max(120).optional().nullable(),
  baseUrl: optionalUrl.optional(),
  /** Plain-text key; encrypted before storage. Empty string clears it. */
  apiKey: z.string().max(500).optional(),
  temperature: z.number().min(0).max(1).optional(),
  tone: z.string().trim().max(200).optional().nullable(),
  language: z.string().trim().max(40).optional().nullable(),
  autoReply: z.boolean().optional(),
  autoFollowUp: z.boolean().optional(),
  autoFirstMessage: z.boolean().optional(),
  requireApprovalFirstMessage: z.boolean().optional(),
  requireApprovalAttachments: z.boolean().optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
  escalatePricing: z.boolean().optional(),
  escalateNegotiation: z.boolean().optional(),
  escalateComplaints: z.boolean().optional(),
  escalateUnusual: z.boolean().optional(),
});
export type AISettingsInput = z.infer<typeof aiSettingsSchema>;

export const autopilotToggleSchema = z.object({
  enabled: z.boolean(),
  /** The UI must send this after showing the confirmation dialog when enabling. */
  confirmed: z.boolean().optional(),
});

export const automationSettingsSchema = z.object({
  apifyToken: z.string().max(500).optional(),
  apifyEnabled: z.boolean().optional(),
  maxConcurrentJobs: z.number().int().min(1).max(20).optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
  jobTimeoutSec: z.number().int().min(30).max(3600).optional(),
  extensionEnabled: z.boolean().optional(),
  preferredProvider: z.enum(["auto", "meta", "extension", "apify", "manual"]).optional(),
});
export type AutomationSettingsInput = z.infer<typeof automationSettingsSchema>;

export const providerConfigSchema = z.object({
  domain: z.enum(["DISCOVERY", "ENRICHMENT", "MESSAGING", "CONTENT"]),
  provider: z.enum(["apify"]),
  platform: z.enum(["INSTAGRAM", "FACEBOOK", "WEB", "ANY"]),
  actorId: z.string().trim().min(3).max(200),
  adapter: z.string().trim().min(2).max(80),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(1).max(100).default(1),
  costLimitUsd: z.number().min(0).max(10_000).optional().nullable(),
  timeoutSec: z.number().int().min(30).max(7200).default(600),
  settings: z.record(z.string(), z.unknown()).default({}),
});
export type ProviderConfigInput = z.infer<typeof providerConfigSchema>;
