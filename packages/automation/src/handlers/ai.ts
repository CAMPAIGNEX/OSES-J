import { classifyIntent, generateFirstMessage, generateReply, intentRequiresEscalation, loadCompanyContext, validateMessageAgainstRules, type AgentContext, type IntentClassification } from "@oses/ai";
import type { DbClient, Platform } from "@oses/database";
import { writeAudit } from "@oses/database";
import { createOutboundMessage, loadConversationForAI, scheduleMessage } from "@oses/messaging";
import { addDays, createLogger, errorMessage } from "@oses/shared";
import { approvalRequired, autoSendAllowed, isContactable, loadPolicy, meetsConfidence, nextSendTime, type AutopilotPolicy } from "../autopilot";
import { loadClientWithRelations, toClientProfile } from "../client-profile";
import type { JobQueue } from "../queue";
import type { JobContext } from "../runner";

const log = createLogger("automation.ai");

interface DeliverOptions {
  db: DbClient;
  queue: JobQueue;
  organizationId: string;
  policy: AutopilotPolicy;
  clientId: string;
  channel: Platform;
  conversationId?: string | null;
  body: string;
  aiActionLogId: string;
  kind: "first_message" | "reply" | "follow_up";
  campaignId?: string | null;
  campaignLeadId?: string | null;
  followUpStep?: number | null;
  /** Force approval regardless of policy (low confidence, rule violations, escalation). */
  forceApproval?: boolean;
  forceReason?: string | null;
}

/**
 * Turn an AI draft into either (a) a message awaiting approval, (b) an immediately dispatched message,
 * or (c) a scheduled message at the next working-hours slot. Returns what happened for logging.
 */
async function deliverDraft(opts: DeliverOptions): Promise<{ outcome: "pending_approval" | "sent" | "queued" | "scheduled" | "requires_user"; messageId?: string; scheduledMessageId?: string; detail?: string }> {
  const { db, organizationId, policy } = opts;
  const client = await db.client.findFirstOrThrow({ where: { id: opts.clientId, organizationId } });
  const ctx = { organizationId, userId: null };
  const needsApproval = opts.forceApproval || approvalRequired(policy, opts.kind);
  if (needsApproval) {
    const res = await createOutboundMessage(db, ctx, { clientId: client.id, conversationId: opts.conversationId ?? undefined, channel: opts.channel, body: opts.body, delivery: "automation", aiActionLogId: opts.aiActionLogId, campaignId: opts.campaignId ?? undefined, authorType: "AI", approvalRequired: true });
    await db.conversation.update({ where: { id: res.conversationId }, data: { aiStatus: "suggestion_ready", ...(opts.forceReason ? { needsHumanReview: true, needsHumanReason: opts.forceReason.slice(0, 300) } : {}) } });
    return { outcome: "pending_approval", messageId: res.message.id, detail: opts.forceReason ?? "approval required by settings" };
  }
  const timing = nextSendTime(policy, client);
  if (timing.delayed) {
    const scheduled = await scheduleMessage(db, ctx, { clientId: client.id, conversationId: opts.conversationId ?? undefined, channel: opts.channel, body: opts.body, scheduledAt: timing.at.toISOString(), timezone: timing.timezone, timezoneMode: "custom", aiActionLogId: opts.aiActionLogId, createdByType: "AI", campaignId: opts.campaignId ?? null, campaignLeadId: opts.campaignLeadId ?? null, followUpStep: opts.followUpStep ?? null });
    return { outcome: "scheduled", scheduledMessageId: scheduled.id, detail: `outside working hours; scheduled for ${timing.at.toISOString()} (${timing.timezone})` };
  }
  const res = await createOutboundMessage(db, ctx, { clientId: client.id, conversationId: opts.conversationId ?? undefined, channel: opts.channel, body: opts.body, delivery: "automation", aiActionLogId: opts.aiActionLogId, campaignId: opts.campaignId ?? undefined, authorType: "AI", preferred: policy.preferredProvider });
  await db.conversation.update({ where: { id: res.conversationId }, data: { aiStatus: "autopilot" } });
  if (res.message.status === "SENT") return { outcome: "sent", messageId: res.message.id };
  if (res.message.status === "QUEUED") return { outcome: "queued", messageId: res.message.id, detail: res.send?.providerKey };
  return { outcome: "requires_user", messageId: res.message.id, detail: res.message.failureReason ?? undefined };
}

async function logDecision(db: DbClient, organizationId: string, input: { clientId: string; conversationId?: string | null; decision: Record<string, unknown>; messageId?: string | null }): Promise<void> {
  await db.aIActionLog.create({
    data: { organizationId, clientId: input.clientId, conversationId: input.conversationId ?? null, messageId: input.messageId ?? null, action: "AUTOPILOT_DECISION", status: "SUCCESS", triggeredBy: "AI", decision: input.decision as object },
  });
}

/** Schedule the next follow-up check for a conversation according to the follow-up ladder. */
export async function scheduleFollowUp(queue: JobQueue, policy: AutopilotPolicy, input: { organizationId: string; conversationId: string; step: number; campaignId?: string | null; campaignLeadId?: string | null; from?: Date; days?: number[] }): Promise<boolean> {
  const ladder = input.days ?? policy.followUpDays;
  const offset = ladder[input.step - 1];
  if (!offset) return false;
  const previousOffset = input.step > 1 ? (ladder[input.step - 2] ?? 0) : 0;
  const at = addDays(input.from ?? new Date(), offset - previousOffset);
  await queue.enqueue({ type: "FOLLOWUP_JOB", organizationId: input.organizationId, payload: { conversationId: input.conversationId, step: input.step, campaignId: input.campaignId ?? null, campaignLeadId: input.campaignLeadId ?? null }, scheduledAt: at, dedupeKey: `followup:${input.conversationId}:${input.step}`, entityType: "Conversation", entityId: input.conversationId });
  return true;
}

// ---------------------------------------------------------------------------
// AI_REPLY_JOB: an inbound message arrived -> classify -> decide -> reply/suggest/escalate
// ---------------------------------------------------------------------------

export async function handleAiReplyJob(ctx: JobContext): Promise<Record<string, unknown>> {
  const { db, queue } = ctx;
  const conversationId = String(ctx.payload.conversationId ?? "");
  const conversation = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) return { skipped: "conversation not found" };
  const organizationId = conversation.organizationId;
  const policy = await loadPolicy(db, organizationId);
  const clientRow = await loadClientWithRelations(db, organizationId, conversation.clientId);
  if (!clientRow) return { skipped: "client not found" };
  if (!isContactable(clientRow)) return { skipped: "client not contactable" };
  const profile = toClientProfile(clientRow, conversation.channel);
  const history = await loadConversationForAI(db, conversation.id);
  const last = history.messages.at(-1);
  if (!last || last.direction !== "INBOUND") return { skipped: "no new inbound message" };

  const agent: AgentContext = { db, organizationId, triggeredBy: "AUTOPILOT", clientId: clientRow.id, conversationId: conversation.id, campaignId: conversation.campaignId };
  let intent: IntentClassification | null = null;
  try {
    intent = (await classifyIntent(agent, history, profile)).result;
  } catch (err) {
    log.warn("intent classification failed", { conversationId, error: errorMessage(err) });
  }
  const updates: Record<string, unknown> = { aiStatus: "idle" };
  if (intent) {
    updates.lastIntent = intent.intent;
    updates.lastIntentConfidence = intent.confidence;
    const statusMap: Record<string, string | undefined> = { INTERESTED: "INTERESTED", NOT_INTERESTED: "NOT_INTERESTED", NEGOTIATION: "NEGOTIATING", PRICE_REQUEST: "INTERESTED", CATALOG_REQUEST: "INTERESTED", SAMPLE_REQUEST: "INTERESTED", MOQ_REQUEST: "INTERESTED" };
    const newStatus = statusMap[intent.intent];
    if (intent.optOut || intent.intent === "DO_NOT_CONTACT") {
      await db.client.update({ where: { id: clientRow.id }, data: { doNotContact: true, doNotContactReason: "Prospect asked not to be contacted", status: "DO_NOT_CONTACT" } });
      await db.scheduledMessage.updateMany({ where: { clientId: clientRow.id, status: { in: ["SCHEDULED", "PENDING_APPROVAL"] } }, data: { status: "CANCELLED", cancelledAt: new Date() } });
      await db.campaignLead.updateMany({ where: { clientId: clientRow.id, status: { in: ["PENDING", "SCHEDULED", "CONTACTED"] } }, data: { status: "STOPPED", stopReason: "do not contact" } });
      await db.conversation.update({ where: { id: conversation.id }, data: { ...updates, needsHumanReview: false, status: "CLOSED" } });
      await writeAudit(db, { organizationId, actorType: "AI", action: "client.do_not_contact", entityType: "Client", entityId: clientRow.id, meta: { reason: "opt-out detected" } });
      await logDecision(db, organizationId, { clientId: clientRow.id, conversationId: conversation.id, decision: { intent: intent.intent, action: "opt_out", reason: "Prospect asked not to be contacted" } });
      return { intent: intent.intent, action: "opt_out" };
    }
    if (newStatus && !["CUSTOMER", "DO_NOT_CONTACT"].includes(clientRow.status)) await db.client.update({ where: { id: clientRow.id }, data: { status: newStatus as never } });
    // A reply stops pending follow-ups for this conversation.
    await db.automationJob.updateMany({ where: { type: "FOLLOWUP_JOB", status: "QUEUED", entityType: "Conversation", entityId: conversation.id }, data: { status: "CANCELLED", completedAt: new Date() } });
    await db.campaignLead.updateMany({ where: { clientId: clientRow.id, status: { in: ["CONTACTED", "SCHEDULED"] } }, data: { status: "REPLIED" } });
  }
  const s = policy.settings;
  const escalation = intent ? intentRequiresEscalation(intent.intent, { escalatePricing: s.escalatePricing, escalateNegotiation: s.escalateNegotiation, escalateComplaints: s.escalateComplaints, escalateUnusual: s.escalateUnusual }) : "Intent could not be classified";
  const lowConfidence = intent ? !meetsConfidence(policy, intent.confidence) : true;
  const humanReason = intent?.needsHuman ? intent.needsHumanReason ?? "AI flagged for human review" : escalation ?? (lowConfidence ? `Low confidence (${Math.round((intent?.confidence ?? 0) * 100)}%)` : null);

  // Manual mode: classify only, never draft automatically.
  if (s.messagingMode === "MANUAL") {
    await db.conversation.update({ where: { id: conversation.id }, data: { ...updates, needsHumanReview: Boolean(humanReason), needsHumanReason: humanReason?.slice(0, 300) ?? null } });
    await logDecision(db, organizationId, { clientId: clientRow.id, conversationId: conversation.id, decision: { intent: intent?.intent, action: "classified_only", mode: "MANUAL", humanReason } });
    return { intent: intent?.intent, action: "classified_only" };
  }
  let draft;
  try {
    draft = await generateReply(agent, { client: profile, conversation: history, intent });
  } catch (err) {
    await db.conversation.update({ where: { id: conversation.id }, data: { ...updates, needsHumanReview: true, needsHumanReason: `AI reply failed: ${errorMessage(err).slice(0, 200)}` } });
    throw err;
  }
  const ruleBlocked = !draft.result.validation.ok;
  const force = Boolean(humanReason) || ruleBlocked || draft.result.openQuestions.length > 0;
  const forceReason = humanReason ?? (ruleBlocked ? `Draft violated business rules: ${draft.result.validation.violations.map((v) => v.detail).join("; ")}` : draft.result.openQuestions.length ? `Prospect asked something not covered by company facts: ${draft.result.openQuestions.join("; ")}` : null);
  const delivered = await deliverDraft({ db, queue, organizationId, policy, clientId: clientRow.id, channel: conversation.channel, conversationId: conversation.id, body: draft.result.message, aiActionLogId: draft.actionLogId, kind: "reply", campaignId: conversation.campaignId, forceApproval: force, forceReason });
  await db.conversation.update({ where: { id: conversation.id }, data: { lastIntent: intent?.intent ?? null, lastIntentConfidence: intent?.confidence ?? null } });
  await logDecision(db, organizationId, { clientId: clientRow.id, conversationId: conversation.id, messageId: delivered.messageId ?? null, decision: { intent: intent?.intent, confidence: intent?.confidence, action: delivered.outcome, reason: delivered.detail ?? null, autoReplyAllowed: autoSendAllowed(policy, "reply"), humanReason } });
  return { intent: intent?.intent, action: delivered.outcome, messageId: delivered.messageId };
}

// ---------------------------------------------------------------------------
// AI_FIRST_MESSAGE_JOB: generate + deliver the first contact for a client
// ---------------------------------------------------------------------------

export async function handleAiFirstMessageJob(ctx: JobContext): Promise<Record<string, unknown>> {
  const { db, queue } = ctx;
  const organizationId = ctx.organizationId;
  if (!organizationId) return { skipped: "no organization" };
  const clientId = String(ctx.payload.clientId ?? "");
  const channel = (ctx.payload.channel as Platform) ?? "INSTAGRAM";
  const campaignId = (ctx.payload.campaignId as string | null) ?? null;
  const campaignLeadId = (ctx.payload.campaignLeadId as string | null) ?? null;
  const policy = await loadPolicy(db, organizationId);
  const clientRow = await loadClientWithRelations(db, organizationId, clientId);
  if (!clientRow) return { skipped: "client not found" };
  if (!isContactable(clientRow)) return { skipped: "client not contactable" };
  const alreadyContacted = await db.message.count({ where: { organizationId, clientId, direction: "OUTBOUND", status: { in: ["SENT", "DELIVERED", "SEEN", "QUEUED", "PENDING_APPROVAL"] } } });
  if (alreadyContacted > 0 && !ctx.payload.force) return { skipped: "client already contacted" };
  const profile = toClientProfile(clientRow, channel);
  const agent: AgentContext = { db, organizationId, triggeredBy: campaignId ? "AUTOPILOT" : "SYSTEM", clientId, campaignId };
  const campaign = campaignId ? await db.campaign.findUnique({ where: { id: campaignId } }) : null;
  let body: string;
  let aiActionLogId: string;
  let violations: string[] = [];
  if (typeof ctx.payload.template === "string" && ctx.payload.template.trim()) {
    // Campaign template mode: no AI generation, but the same business-rule validation applies.
    body = ctx.payload.template.trim();
    const company = await loadCompanyContext(db, organizationId);
    violations = validateMessageAgainstRules(body, { factsText: company.factsText, prohibitedText: company.prohibitedText, escalatePricing: policy.settings.escalatePricing }).violations.filter((v) => v.severity === "block").map((v) => v.detail);
    const logRow = await db.aIActionLog.create({ data: { organizationId, clientId, campaignId, action: "GENERATE_FIRST_MESSAGE", status: violations.length ? "BLOCKED" : "SUCCESS", triggeredBy: "SYSTEM", output: { template: true, violations } as object } });
    aiActionLogId = logRow.id;
  } else {
    const draft = await generateFirstMessage(agent, { client: profile, channel });
    body = draft.result.message;
    aiActionLogId = draft.actionLogId;
    violations = draft.result.validation.violations.filter((v) => v.severity === "block").map((v) => v.detail);
  }
  const ruleBlocked = violations.length > 0;
  const force = ruleBlocked || Boolean(campaign?.requireApproval) || policy.settings.requireApprovalFirstMessage;
  const delivered = await deliverDraft({ db, queue, organizationId, policy, clientId, channel, body, aiActionLogId, kind: "first_message", campaignId, campaignLeadId, forceApproval: force, forceReason: ruleBlocked ? `Draft violated business rules: ${violations.join("; ")}` : force ? "First messages require approval" : null });
  if (campaignLeadId) {
    const conv = delivered.messageId ? await db.message.findUnique({ where: { id: delivered.messageId }, select: { conversationId: true } }) : null;
    await db.campaignLead.update({ where: { id: campaignLeadId }, data: { status: delivered.outcome === "sent" || delivered.outcome === "queued" ? "CONTACTED" : "SCHEDULED", currentStep: 1, conversationId: conv?.conversationId ?? null, lastMessageAt: new Date() } });
  }
  if ((delivered.outcome === "sent" || delivered.outcome === "queued") && delivered.messageId) {
    const msg = await db.message.findUnique({ where: { id: delivered.messageId }, select: { conversationId: true } });
    if (msg && (policy.settings.autoFollowUp || campaign)) {
      const ladder = campaign ? ((campaign.followUps as Array<{ dayOffset: number }> | null) ?? []).map((f) => f.dayOffset) : policy.followUpDays;
      await scheduleFollowUp(queue, policy, { organizationId, conversationId: msg.conversationId, step: 1, campaignId, campaignLeadId, days: ladder });
    }
  }
  await logDecision(db, organizationId, { clientId, decision: { action: delivered.outcome, kind: "first_message", reason: delivered.detail ?? null, campaignId }, messageId: delivered.messageId ?? null });
  return { action: delivered.outcome, messageId: delivered.messageId };
}

// ---------------------------------------------------------------------------
// FOLLOWUP_JOB: send/suggest follow-up #step when the prospect has not replied
// ---------------------------------------------------------------------------

export async function handleFollowUpJob(ctx: JobContext): Promise<Record<string, unknown>> {
  const { db, queue } = ctx;
  const conversationId = String(ctx.payload.conversationId ?? "");
  const step = Number(ctx.payload.step ?? 1);
  const campaignId = (ctx.payload.campaignId as string | null) ?? null;
  const campaignLeadId = (ctx.payload.campaignLeadId as string | null) ?? null;
  const conversation = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) return { skipped: "conversation not found" };
  const organizationId = conversation.organizationId;
  const policy = await loadPolicy(db, organizationId);
  const clientRow = await loadClientWithRelations(db, organizationId, conversation.clientId);
  if (!clientRow || !isContactable(clientRow)) return { skipped: "client not contactable" };
  if (conversation.status !== "OPEN") return { skipped: "conversation closed" };
  if (conversation.lastInboundAt && (!conversation.lastOutboundAt || conversation.lastInboundAt > conversation.lastOutboundAt)) return { skipped: "client replied" };
  if (conversation.lastInboundAt) return { skipped: "conversation already has replies" };
  const campaign = campaignId ? await db.campaign.findUnique({ where: { id: campaignId } }) : null;
  if (campaign && campaign.status !== "RUNNING") return { skipped: `campaign ${campaign.status.toLowerCase()}` };
  if (!campaign && !policy.settings.autoFollowUp && policy.settings.messagingMode === "MANUAL") return { skipped: "auto follow-up disabled" };
  const pendingApproval = await db.message.count({ where: { conversationId, status: "PENDING_APPROVAL" } });
  if (pendingApproval > 0) return { skipped: "a message is still awaiting approval" };

  const profile = toClientProfile(clientRow, conversation.channel);
  const history = await loadConversationForAI(db, conversation.id);
  const agent: AgentContext = { db, organizationId, triggeredBy: "AUTOPILOT", clientId: clientRow.id, conversationId, campaignId };
  const template = campaign ? ((campaign.followUps as Array<{ dayOffset: number; template?: string | null }> | null) ?? [])[step - 1]?.template : null;
  let body: string;
  let aiActionLogId: string;
  let ruleBlocked = false;
  let violations = "";
  if (template) {
    body = template.replace(/\{\{\s*brand\s*\}\}/gi, clientRow.brandName);
    const logRow = await db.aIActionLog.create({ data: { organizationId, clientId: clientRow.id, conversationId, campaignId, action: "GENERATE_FOLLOW_UP", status: "SUCCESS", triggeredBy: "SYSTEM", output: { template: true } as object } });
    aiActionLogId = logRow.id;
  } else {
    const draft = await generateReply(agent, { client: profile, conversation: history, kind: "follow_up", followUpStep: step });
    body = draft.result.message;
    aiActionLogId = draft.actionLogId;
    ruleBlocked = !draft.result.validation.ok;
    violations = draft.result.validation.violations.map((v) => v.detail).join("; ");
  }
  const delivered = await deliverDraft({ db, queue, organizationId, policy, clientId: clientRow.id, channel: conversation.channel, conversationId, body, aiActionLogId, kind: "follow_up", campaignId, campaignLeadId, followUpStep: step, forceApproval: ruleBlocked || Boolean(campaign?.requireApproval), forceReason: ruleBlocked ? `Draft violated business rules: ${violations}` : campaign?.requireApproval ? "Campaign requires approval" : null });
  const ladder = campaign ? ((campaign.followUps as Array<{ dayOffset: number }> | null) ?? []).map((f) => f.dayOffset) : policy.followUpDays;
  const scheduledNext = await scheduleFollowUp(queue, policy, { organizationId, conversationId, step: step + 1, campaignId, campaignLeadId, days: ladder });
  if (campaignLeadId) await db.campaignLead.update({ where: { id: campaignLeadId }, data: { currentStep: step + 1, lastMessageAt: new Date(), status: scheduledNext ? "CONTACTED" : "COMPLETED" } });
  await logDecision(db, organizationId, { clientId: clientRow.id, conversationId, messageId: delivered.messageId ?? null, decision: { action: delivered.outcome, kind: "follow_up", step, reason: delivered.detail ?? null, nextScheduled: scheduledNext } });
  return { action: delivered.outcome, step, nextScheduled: scheduledNext };
}
