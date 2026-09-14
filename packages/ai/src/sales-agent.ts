import type { AIActionType, DbClient } from "@oses/database";
import { recordUsage } from "@oses/database";
import { AI_INTENTS, createLogger, errorMessage, redact, type AIIntent } from "@oses/shared";
import { z } from "zod";
import { loadCompanyContext, retrieveKnowledge, type CompanyContext, type RetrievedChunk } from "./knowledge";
import { buildSystemPrompt, renderClientProfile, renderConversation, type ClientProfileForAI, type ConversationForAI } from "./prompts";
import { requireAIProvider } from "./resolve";
import { validateMessageAgainstRules, type RuleValidationResult } from "./rules";
import type { AIGenerateRequest, AIProvider, AIResult } from "./types";

const log = createLogger("ai.agent");

export interface AgentContext {
  db: DbClient;
  organizationId: string;
  /** Who triggered the action (for the AI action log). */
  triggeredBy: "USER" | "AUTOPILOT" | "SYSTEM";
  userId?: string | null;
  clientId?: string | null;
  conversationId?: string | null;
  campaignId?: string | null;
  /** Inject a provider (tests); otherwise resolved from organization settings/env. */
  provider?: AIProvider;
  company?: CompanyContext;
}

export interface AgentOutcome<T> {
  result: T;
  actionLogId: string;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
  provider: string;
}

// ---------- Structured output schemas ----------

export const leadAnalysisSchema = z.object({
  summary: z.string().describe("2-3 sentence summary of who this brand is and what they sell"),
  fitScore: z.number().min(0).max(100).describe("How well this prospect fits the exporter's products, 0-100"),
  likelyProducts: z.array(z.string()).describe("Products from COMPANY FACTS this prospect is most likely to buy"),
  talkingPoints: z.array(z.string()).describe("Specific, non-creepy personalization hooks visible in the profile"),
  risks: z.array(z.string()).describe("Reasons this may not be a good lead (e.g. reseller, private account, wrong category)"),
  suggestedChannel: z.enum(["INSTAGRAM", "FACEBOOK", "EMAIL", "WHATSAPP"]).describe("Best channel given the available contact points"),
  confidence: z.number().min(0).max(1),
});
export type LeadAnalysis = z.infer<typeof leadAnalysisSchema>;

export const draftMessageSchema = z.object({
  message: z.string().describe("The message text exactly as it should be sent"),
  personalizationUsed: z.array(z.string()).describe("Which profile facts were used for personalization"),
  factsUsed: z.array(z.string()).describe("Which COMPANY FACTS / KNOWLEDGE items were used"),
  openQuestions: z.array(z.string()).describe("Things the prospect asked that could not be answered from the facts"),
  confidence: z.number().min(0).max(1),
});
export type DraftMessage = z.infer<typeof draftMessageSchema>;

export const intentSchema = z.object({
  intent: z.enum(AI_INTENTS),
  confidence: z.number().min(0).max(1),
  summary: z.string().describe("One sentence describing what the prospect wants"),
  needsHuman: z.boolean().describe("True when a human should take over (complaint, legal, negotiation, unclear, sensitive)"),
  needsHumanReason: z.string().nullable(),
  optOut: z.boolean().describe("True when the prospect asked not to be contacted"),
});
export type IntentClassification = z.infer<typeof intentSchema>;

export const conversationSummarySchema = z.object({
  summary: z.string(),
  stage: z.enum(["NEW", "CONTACTED", "REPLIED", "INTERESTED", "NEGOTIATING", "CUSTOMER", "NOT_INTERESTED", "DO_NOT_CONTACT"]),
  nextAction: z.object({
    action: z.enum(["reply", "follow_up", "send_catalog", "send_price_list", "wait", "close", "escalate"]),
    when: z.string().describe("e.g. 'now', 'in 3 days', 'after human review'"),
    reason: z.string(),
  }),
  confidence: z.number().min(0).max(1),
});
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;

// ---------- Core helpers ----------

async function prepare(ctx: AgentContext): Promise<{ provider: AIProvider; company: CompanyContext; temperature: number | null }> {
  const company = ctx.company ?? (await loadCompanyContext(ctx.db, ctx.organizationId));
  if (ctx.provider) return { provider: ctx.provider, company, temperature: null };
  const resolved = await requireAIProvider(ctx.db, ctx.organizationId);
  return { provider: resolved.provider, company, temperature: resolved.temperature };
}

async function logAction(
  ctx: AgentContext,
  action: AIActionType,
  input: { inputContext: unknown; output?: unknown; decision?: unknown; confidence?: number | null; result?: AIResult | null; status: "SUCCESS" | "FAILED" | "BLOCKED"; error?: string | null; messageId?: string | null },
): Promise<string> {
  const row = await ctx.db.aIActionLog.create({
    data: {
      organizationId: ctx.organizationId,
      clientId: ctx.clientId ?? null,
      conversationId: ctx.conversationId ?? null,
      campaignId: ctx.campaignId ?? null,
      messageId: input.messageId ?? null,
      action,
      status: input.status,
      triggeredBy: ctx.triggeredBy === "AUTOPILOT" ? "AI" : ctx.triggeredBy,
      userId: ctx.userId ?? null,
      provider: input.result?.provider ?? null,
      model: input.result?.model ?? null,
      inputContext: redact(input.inputContext) as object,
      output: input.output === undefined ? undefined : (input.output as object),
      decision: input.decision === undefined ? undefined : (input.decision as object),
      confidence: input.confidence ?? null,
      tokensIn: input.result?.usage.inputTokens ?? null,
      tokensOut: input.result?.usage.outputTokens ?? null,
      durationMs: input.result?.durationMs ?? null,
      error: input.error ?? null,
    },
  });
  if (input.result) {
    await recordUsage(ctx.db, ctx.organizationId, "AI_REQUESTS", 1);
    await recordUsage(ctx.db, ctx.organizationId, "AI_TOKENS_IN", input.result.usage.inputTokens);
    await recordUsage(ctx.db, ctx.organizationId, "AI_TOKENS_OUT", input.result.usage.outputTokens);
  }
  return row.id;
}

async function runStructured<T>(ctx: AgentContext, action: AIActionType, provider: AIProvider, request: AIGenerateRequest & { jsonSchema: { name: string; schema: z.ZodType<T> } }, inputContext: unknown): Promise<{ data: T; result: AIResult; actionLogId: string }> {
  let result: AIResult;
  try {
    result = await provider.generate(request);
  } catch (err) {
    const message = errorMessage(err);
    const actionLogId = await logAction(ctx, action, { inputContext, status: "FAILED", error: message });
    log.warn("ai action failed", { action, error: message });
    throw Object.assign(err instanceof Error ? err : new Error(message), { actionLogId });
  }
  if (result.refusal) {
    const actionLogId = await logAction(ctx, action, { inputContext, status: "BLOCKED", result, error: `Model declined: ${result.refusal.explanation ?? result.refusal.category ?? "policy"}` });
    throw Object.assign(new Error("The AI provider declined this request."), { actionLogId });
  }
  const data = result.json as T;
  const actionLogId = await logAction(ctx, action, { inputContext, output: data, status: "SUCCESS", result, confidence: (data as { confidence?: number })?.confidence ?? null });
  return { data, result, actionLogId };
}

function outcome<T>(data: T, result: AIResult, actionLogId: string): AgentOutcome<T> {
  return { result: data, actionLogId, usage: result.usage, model: result.model, provider: result.provider };
}

// ---------- Actions ----------

export async function analyzeLead(ctx: AgentContext, client: ClientProfileForAI): Promise<AgentOutcome<LeadAnalysis>> {
  const { provider, company } = await prepare(ctx);
  const system = buildSystemPrompt("Analyze a prospect for B2B fit. Be honest and specific; unknowns stay unknown.", { company });
  const user = `PROSPECT PROFILE:\n${renderClientProfile(client)}\n\nAnalyze this prospect for our products. Return the JSON object.`;
  const { data, result, actionLogId } = await runStructured(ctx, "ANALYZE_LEAD", provider, { system, messages: [{ role: "user", content: user }], jsonSchema: { name: "lead_analysis", schema: leadAnalysisSchema }, effort: "medium", maxTokens: 2048, purpose: "analyze_lead" }, { client });
  return outcome(data, result, actionLogId);
}

export interface FirstMessageInput {
  client: ClientProfileForAI;
  channel: string;
  instruction?: string | null;
  variant?: "regenerate" | "shorter" | "more_professional" | "more_friendly" | "personalize" | null;
  previousDraft?: string | null;
  tone?: string | null;
  language?: string | null;
}

export interface GeneratedMessage extends DraftMessage {
  validation: RuleValidationResult;
  /** Number of attempts needed to pass rule validation. */
  attempts: number;
}

const VARIANT_INSTRUCTIONS: Record<NonNullable<FirstMessageInput["variant"]>, string> = {
  regenerate: "Write a fresh, different version.",
  shorter: "Make it noticeably shorter (max 3 short sentences) while keeping the personalization and the question.",
  more_professional: "Make the tone more formal and professional, still warm.",
  more_friendly: "Make the tone warmer and more conversational, still professional B2B.",
  personalize: "Add one more specific, respectful reference to something visible in the prospect profile.",
};

async function generateWithValidation(ctx: AgentContext, action: AIActionType, provider: AIProvider, company: CompanyContext, system: string, user: string, inputContext: unknown, escalatePricing: boolean, maxTokens = 1500): Promise<AgentOutcome<GeneratedMessage>> {
  let attempts = 0;
  let lastViolations: string[] = [];
  let last: { data: DraftMessage; result: AIResult; actionLogId: string } | null = null;
  while (attempts < 2) {
    attempts++;
    const content = lastViolations.length ? `${user}\n\nYour previous draft violated these rules; fix them and rewrite:\n- ${lastViolations.join("\n- ")}` : user;
    last = await runStructured(ctx, action, provider, { system, messages: [{ role: "user", content }], jsonSchema: { name: "draft_message", schema: draftMessageSchema }, effort: "medium", maxTokens, purpose: String(action).toLowerCase() }, inputContext);
    const validation = validateMessageAgainstRules(last.data.message, { factsText: company.factsText, prohibitedText: company.prohibitedText, escalatePricing });
    if (validation.ok) return outcome({ ...last.data, validation, attempts }, last.result, last.actionLogId);
    lastViolations = validation.violations.filter((v) => v.severity === "block").map((v) => v.detail);
  }
  const validation = validateMessageAgainstRules(last!.data.message, { factsText: company.factsText, prohibitedText: company.prohibitedText, escalatePricing });
  await ctx.db.aIActionLog.update({ where: { id: last!.actionLogId }, data: { status: "BLOCKED", decision: { blocked: true, violations: validation.violations } as object } });
  return outcome({ ...last!.data, validation, attempts }, last!.result, last!.actionLogId);
}

export async function generateFirstMessage(ctx: AgentContext, input: FirstMessageInput): Promise<AgentOutcome<GeneratedMessage>> {
  const { provider, company } = await prepare(ctx);
  const settings = await ctx.db.organizationSettings.findUnique({ where: { organizationId: ctx.organizationId }, select: { escalatePricing: true, aiTone: true, aiLanguage: true } });
  const knowledge = await retrieveKnowledge(ctx.db, ctx.organizationId, `${input.client.category ?? ""} ${input.client.bio ?? ""} ${input.client.brandName} first contact introduction products`, { limit: 4 }).catch(() => [] as RetrievedChunk[]);
  const system = buildSystemPrompt(
    `Write the FIRST direct message to a prospect on ${input.channel}. Goal: start a conversation about supplying their apparel/sportswear production (custom / private label). Keep it under 90 words, 3-5 short sentences, one clear question at the end, no links unless the company website is in COMPANY FACTS, no bullet lists, no subject line, no signature block.`,
    { company, knowledge, tone: input.tone ?? settings?.aiTone, language: input.language ?? settings?.aiLanguage },
  );
  const parts = [`PROSPECT PROFILE:\n${renderClientProfile(input.client)}`];
  if (input.instruction) parts.push(`EXTRA INSTRUCTION FROM THE USER: ${input.instruction}`);
  if (input.variant && input.previousDraft) parts.push(`PREVIOUS DRAFT:\n${input.previousDraft}\n\nREQUEST: ${VARIANT_INSTRUCTIONS[input.variant]}`);
  parts.push("Return the JSON object.");
  return generateWithValidation(ctx, "GENERATE_FIRST_MESSAGE", provider, company, system, parts.join("\n\n"), { client: input.client, channel: input.channel, variant: input.variant, instruction: input.instruction }, settings?.escalatePricing ?? true, 1200);
}

export async function classifyIntent(ctx: AgentContext, conversation: ConversationForAI, client: ClientProfileForAI): Promise<AgentOutcome<IntentClassification>> {
  const { provider, company } = await prepare(ctx);
  const system = buildSystemPrompt("Classify the intent of the prospect's latest message in a B2B sales conversation.", { company });
  const user = `PROSPECT PROFILE:\n${renderClientProfile(client)}\n\nCONVERSATION:\n${renderConversation(conversation)}\n\nClassify the LAST prospect message. Intent options: ${AI_INTENTS.join(", ")}. Return the JSON object.`;
  const { data, result, actionLogId } = await runStructured(ctx, "CLASSIFY_INTENT", provider, { system, messages: [{ role: "user", content: user }], jsonSchema: { name: "intent", schema: intentSchema }, effort: "low", maxTokens: 600, purpose: "classify_intent" }, { lastMessage: conversation.messages.at(-1)?.body });
  return outcome(data, result, actionLogId);
}

export interface ReplyInput {
  client: ClientProfileForAI;
  conversation: ConversationForAI;
  intent?: IntentClassification | null;
  instruction?: string | null;
  kind?: "reply" | "follow_up";
  followUpStep?: number;
}

export async function generateReply(ctx: AgentContext, input: ReplyInput): Promise<AgentOutcome<GeneratedMessage>> {
  const { provider, company } = await prepare(ctx);
  const settings = await ctx.db.organizationSettings.findUnique({ where: { organizationId: ctx.organizationId }, select: { escalatePricing: true, aiTone: true, aiLanguage: true } });
  const lastInbound = [...input.conversation.messages].reverse().find((m) => m.direction === "INBOUND");
  const knowledgeQuery = [lastInbound?.body, input.intent?.summary, input.client.category].filter(Boolean).join(" ");
  const knowledge = await retrieveKnowledge(ctx.db, ctx.organizationId, knowledgeQuery || input.client.brandName, { limit: 6 }).catch(() => [] as RetrievedChunk[]);
  const isFollowUp = input.kind === "follow_up";
  const task = isFollowUp
    ? `Write follow-up message #${input.followUpStep ?? 1} to a prospect who has not replied yet. Be brief (2-3 sentences), add one new piece of value or angle, no guilt-tripping, end with an easy question. Never repeat the first message.`
    : `Write the next reply in this conversation. Answer only from COMPANY FACTS / KNOWLEDGE. If the prospect asks something not covered (price, MOQ details, delivery, certifications), say a team member will confirm and ask a clarifying question instead of guessing. Keep it under 120 words.`;
  const system = buildSystemPrompt(task, { company, knowledge, tone: settings?.aiTone, language: settings?.aiLanguage });
  const parts = [`PROSPECT PROFILE:\n${renderClientProfile(input.client)}`, `CONVERSATION SO FAR:\n${renderConversation(input.conversation)}`];
  if (input.intent) parts.push(`DETECTED INTENT: ${input.intent.intent} (${Math.round(input.intent.confidence * 100)}%) - ${input.intent.summary}`);
  if (input.instruction) parts.push(`EXTRA INSTRUCTION FROM THE USER: ${input.instruction}`);
  parts.push("Return the JSON object.");
  return generateWithValidation(ctx, isFollowUp ? "GENERATE_FOLLOW_UP" : "GENERATE_REPLY", provider, company, system, parts.join("\n\n"), { intent: input.intent?.intent, lastInbound: lastInbound?.body, followUpStep: input.followUpStep }, settings?.escalatePricing ?? true, 1500);
}

export async function summarizeConversation(ctx: AgentContext, conversation: ConversationForAI, client: ClientProfileForAI): Promise<AgentOutcome<ConversationSummary>> {
  const { provider, company } = await prepare(ctx);
  const system = buildSystemPrompt("Summarize a B2B sales conversation and recommend the next action.", { company });
  const user = `PROSPECT PROFILE:\n${renderClientProfile(client)}\n\nCONVERSATION:\n${renderConversation(conversation, 60)}\n\nReturn the JSON object.`;
  const { data, result, actionLogId } = await runStructured(ctx, "SUMMARIZE_CONVERSATION", provider, { system, messages: [{ role: "user", content: user }], jsonSchema: { name: "conversation_summary", schema: conversationSummarySchema }, effort: "low", maxTokens: 1000, purpose: "summarize" }, { messageCount: conversation.messages.length });
  return outcome(data, result, actionLogId);
}

/** Free-form transformation of a user-edited draft (e.g. "make it shorter") without profile context. */
export async function transformDraft(ctx: AgentContext, draft: string, variant: NonNullable<FirstMessageInput["variant"]>, client?: ClientProfileForAI): Promise<AgentOutcome<GeneratedMessage>> {
  const { provider, company } = await prepare(ctx);
  const settings = await ctx.db.organizationSettings.findUnique({ where: { organizationId: ctx.organizationId }, select: { escalatePricing: true } });
  const system = buildSystemPrompt("Rewrite a sales message draft as requested, preserving its meaning and any facts it already contains.", { company });
  const user = `${client ? `PROSPECT PROFILE:\n${renderClientProfile(client)}\n\n` : ""}DRAFT:\n${draft}\n\nREQUEST: ${VARIANT_INSTRUCTIONS[variant]}\n\nReturn the JSON object.`;
  return generateWithValidation(ctx, "GENERATE_FIRST_MESSAGE", provider, company, system, user, { variant, draftLength: draft.length }, settings?.escalatePricing ?? true, 1200);
}

export type { AIIntent };
