import { z } from "zod";
import { idSchema, paginationQuerySchema, platformSchema, timezoneSchema } from "./common";

export const MESSAGE_VARIANTS = ["regenerate", "shorter", "more_professional", "more_friendly", "personalize"] as const;

/** POST /api/messages/generate */
export const generateMessageSchema = z.object({
  clientId: idSchema,
  conversationId: idSchema.optional(),
  channel: platformSchema.optional(),
  /** Kind of message to generate. */
  kind: z.enum(["first_contact", "reply", "follow_up"]).default("first_contact"),
  variant: z.enum(MESSAGE_VARIANTS).optional(),
  /** Draft to transform when a variant is requested. */
  previousDraft: z.string().max(5000).optional(),
  instruction: z.string().trim().max(1000).optional(),
});
export type GenerateMessageInput = z.infer<typeof generateMessageSchema>;

/** POST /api/messages/send */
export const sendMessageSchema = z.object({
  clientId: idSchema,
  conversationId: idSchema.optional(),
  channel: platformSchema,
  body: z.string().trim().min(1, "Message cannot be empty").max(4000),
  /**
   * manual      = the user sends it themselves (we record it and open the platform)
   * automation  = queue for the configured provider (extension / Apify / Meta)
   */
  delivery: z.enum(["manual", "automation"]).default("automation"),
  aiActionLogId: idSchema.optional(),
  attachmentDocumentIds: z.array(idSchema).max(5).optional(),
  campaignId: idSchema.optional(),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

/** POST /api/messages/schedule */
export const scheduleMessageSchema = z.object({
  clientId: idSchema,
  conversationId: idSchema.optional(),
  channel: platformSchema,
  body: z.string().trim().min(1).max(4000),
  /** Wall-clock time in `timezone` as ISO-like "YYYY-MM-DDTHH:mm" or full ISO datetime. */
  scheduledAt: z.string().min(10).max(40),
  timezone: timezoneSchema.optional(),
  timezoneMode: z.enum(["client", "exporter", "custom"]).default("client"),
  aiActionLogId: idSchema.optional(),
});
export type ScheduleMessageInput = z.infer<typeof scheduleMessageSchema>;

export const conversationListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(200).optional(),
  channel: platformSchema.optional(),
  unread: z.coerce.boolean().optional(),
  assignedUserId: idSchema.optional(),
  aiStatus: z.enum(["idle", "suggestion_ready", "needs_review", "autopilot"]).optional(),
  clientStatus: z.string().max(40).optional(),
  tag: z.string().max(60).optional(),
  status: z.enum(["OPEN", "CLOSED", "ARCHIVED"]).optional(),
});
export type ConversationListQuery = z.infer<typeof conversationListQuerySchema>;

/** Record a message the user sent manually outside OSES J, or an inbound reply typed in by the user. */
export const logManualMessageSchema = z.object({
  conversationId: idSchema,
  direction: z.enum(["OUTBOUND", "INBOUND"]),
  body: z.string().trim().min(1).max(4000),
  sentAt: z.iso.datetime().optional(),
});

export const updateConversationSchema = z.object({
  status: z.enum(["OPEN", "CLOSED", "ARCHIVED"]).optional(),
  assignedUserId: idSchema.nullable().optional(),
  markRead: z.boolean().optional(),
  needsHumanReview: z.boolean().optional(),
});

export const messageJobListQuerySchema = paginationQuerySchema.extend({
  status: z.string().max(40).optional(),
  provider: z.string().max(40).optional(),
});
