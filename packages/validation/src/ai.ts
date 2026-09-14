import { z } from "zod";
import { idSchema, paginationQuerySchema } from "./common";

export const AI_INSTRUCTION_KINDS = ["COMPANY", "PRODUCTS", "TONE", "RULES", "PROHIBITED", "ESCALATION", "WORKING_HOURS", "CUSTOM"] as const;

export const instructionSchema = z.object({
  kind: z.enum(AI_INSTRUCTION_KINDS).default("CUSTOM"),
  title: z.string().trim().min(1).max(140),
  content: z.string().trim().min(1).max(20_000),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});
export type InstructionInput = z.infer<typeof instructionSchema>;

export const updateInstructionSchema = instructionSchema.partial();

export const knowledgeTextSchema = z.object({
  title: z.string().trim().min(1).max(140),
  content: z.string().trim().min(1).max(500_000),
});

export const aiActionLogQuerySchema = paginationQuerySchema.extend({
  clientId: idSchema.optional(),
  action: z.string().max(60).optional(),
  status: z.enum(["SUCCESS", "FAILED", "BLOCKED"]).optional(),
});

export const summarizeConversationSchema = z.object({ conversationId: idSchema });

export const analyzeLeadSchema = z.object({ clientId: idSchema });

export const aiReplySuggestionSchema = z.object({ conversationId: idSchema, instruction: z.string().trim().max(1000).optional() });
