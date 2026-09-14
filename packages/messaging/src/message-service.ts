import type { Client, ClientSocialAccount, DbClient, Message, MessageJob, MessageJobStatus, Prisma } from "@oses/database";
import { getOrCreateSettings, parseWorkingHours, recordUsage, writeAudit } from "@oses/database";
import { AppError, ConflictError, isValidTimeZone, NotFoundError, RateLimitError, zonedTimeToUtc, type ErrorClass, type Platform } from "@oses/shared";
import type { ScheduleMessageInput, SendMessageInput } from "@oses/validation";
import { getOrCreateConversation, touchConversation, type RequestContext } from "./conversation-service";
import { resolveMessagingProvider, targetFromSocialAccount, type PreferredProvider } from "./provider-resolver";
import type { MessageJobTarget, ProviderDecision, SendMessageResult } from "./types";

export interface OutboundResult {
  message: Message;
  conversationId: string;
  decision: ProviderDecision | null;
  send: SendMessageResult | null;
  job: MessageJob | null;
  /** Deep link the user can open to send manually when automation is not possible. */
  openUrl: string | null;
}

async function findSocialAccount(db: DbClient, organizationId: string, clientId: string, channel: Platform): Promise<ClientSocialAccount | null> {
  return db.clientSocialAccount.findFirst({ where: { organizationId, clientId, platform: channel }, orderBy: { createdAt: "asc" } });
}

/** Enforce organization-level send limits (messages per hour / day, minimum spacing). */
export async function checkRateLimit(db: DbClient, organizationId: string): Promise<void> {
  const settings = await getOrCreateSettings(db, organizationId);
  const now = Date.now();
  const hourAgo = new Date(now - 3_600_000);
  const dayAgo = new Date(now - 86_400_000);
  const where = (since: Date): Prisma.MessageWhereInput => ({ organizationId, direction: "OUTBOUND", status: { in: ["QUEUED", "SENDING", "SENT", "DELIVERED", "SEEN"] }, createdAt: { gte: since } });
  const [hour, day] = await Promise.all([db.message.count({ where: where(hourAgo) }), db.message.count({ where: where(dayAgo) })]);
  if (hour >= settings.messagesPerHour) throw new RateLimitError(`Hourly message limit reached (${settings.messagesPerHour}). Adjust it in Settings > Messaging.`, { limit: settings.messagesPerHour, window: "hour" });
  if (day >= settings.messagesPerDay) throw new RateLimitError(`Daily message limit reached (${settings.messagesPerDay}). Adjust it in Settings > Messaging.`, { limit: settings.messagesPerDay, window: "day" });
}

async function assertContactable(client: Client): Promise<void> {
  if (client.deletedAt) throw new NotFoundError("Client");
  if (client.doNotContact || client.status === "DO_NOT_CONTACT") throw new ConflictError("This client is marked do-not-contact.", { code: "DO_NOT_CONTACT" });
}

/**
 * Create an outbound message and either record it as sent manually or hand it to the resolved provider.
 * The provider decision is stored on the message so the exporter can always see what happened.
 */
export async function createOutboundMessage(db: DbClient, ctx: RequestContext, input: SendMessageInput & { authorType?: "USER" | "AI"; triggeredByAutomation?: boolean; preferred?: PreferredProvider; approvalRequired?: boolean }): Promise<OutboundResult> {
  const client = await db.client.findFirst({ where: { id: input.clientId, organizationId: ctx.organizationId } });
  if (!client) throw new NotFoundError("Client");
  await assertContactable(client);
  await checkRateLimit(db, ctx.organizationId);
  const account = await findSocialAccount(db, ctx.organizationId, client.id, input.channel);
  const conversation = input.conversationId
    ? await db.conversation.findFirstOrThrow({ where: { id: input.conversationId, organizationId: ctx.organizationId } })
    : await getOrCreateConversation(db, { organizationId: ctx.organizationId, clientId: client.id, channel: input.channel, clientSocialAccountId: account?.id ?? null, campaignId: input.campaignId ?? null });
  const settings = await getOrCreateSettings(db, ctx.organizationId);
  const authorType = input.authorType ?? "USER";
  const aiGenerated = Boolean(input.aiActionLogId);
  const aiLog = input.aiActionLogId ? await db.aIActionLog.findFirst({ where: { id: input.aiActionLogId, organizationId: ctx.organizationId }, select: { model: true } }) : null;

  const message = await db.message.create({
    data: {
      organizationId: ctx.organizationId,
      conversationId: conversation.id,
      clientId: client.id,
      channel: input.channel,
      direction: "OUTBOUND",
      authorType,
      userId: ctx.userId ?? null,
      body: input.body,
      status: input.approvalRequired ? "PENDING_APPROVAL" : "DRAFT",
      approvalStatus: input.approvalRequired ? "PENDING" : "NONE",
      aiGenerated,
      aiModel: aiLog?.model ?? null,
      aiActionLogId: input.aiActionLogId ?? null,
      campaignId: input.campaignId ?? null,
    },
  });
  if (input.aiActionLogId) await db.aIActionLog.updateMany({ where: { id: input.aiActionLogId }, data: { messageId: message.id } });
  if (input.attachmentDocumentIds?.length) {
    const docs = await db.document.findMany({ where: { id: { in: input.attachmentDocumentIds }, organizationId: ctx.organizationId, deletedAt: null } });
    for (const d of docs) await db.messageAttachment.create({ data: { messageId: message.id, documentId: d.id, name: d.name, mimeType: d.mimeType, sizeBytes: d.sizeBytes } });
  }
  if (input.approvalRequired) {
    await touchConversation(db, conversation.id, message);
    return { message, conversationId: conversation.id, decision: null, send: null, job: null, openUrl: account?.inboxUrl ?? account?.profileUrl ?? null };
  }
  return dispatchMessage(db, ctx, message, conversation.id, account, client, input.delivery, input.preferred ?? (settings.preferredProvider as PreferredProvider));
}

/** Hand a DRAFT/approved message to the delivery path (manual record or provider job). */
export async function dispatchMessage(db: DbClient, ctx: RequestContext, message: Message, conversationId: string, account: ClientSocialAccount | null, client: Client, delivery: "manual" | "automation", preferred: PreferredProvider = "auto"): Promise<OutboundResult> {
  const openUrl = account?.inboxUrl ?? account?.profileUrl ?? null;
  if (delivery === "manual" || !account) {
    // The user sends it themselves; we record it as sent by a human (status cannot be tracked).
    const sent = await db.message.update({ where: { id: message.id }, data: { status: "SENT", providerKey: "manual", sentAt: new Date(), meta: { manual: true, reason: account ? "user chose manual delivery" : "no social account for this channel" } as object } });
    await afterSent(db, ctx, sent, client, "manual");
    await writeAudit(db, { organizationId: ctx.organizationId, userId: ctx.userId ?? null, actorType: message.authorType === "AI" ? "AI" : "USER", action: "message.sent", entityType: "Message", entityId: message.id, meta: { provider: "manual", channel: message.channel } });
    return { message: sent, conversationId, decision: null, send: { status: "SENT", providerKey: "manual", statusTracking: false }, job: null, openUrl };
  }
  const target = targetFromSocialAccount(account, null);
  const decision = await resolveMessagingProvider(db, ctx.organizationId, target, preferred);
  await db.clientSocialAccount.update({ where: { id: account.id }, data: { messagingEligibility: decision.provider ? decision.capability.eligibility : "REQUIRES_USER", eligibilityReason: decision.capability.reason?.slice(0, 300) ?? null, eligibilityCheckedAt: new Date() } });
  const decisionMeta = { providerKey: decision.providerKey, reason: decision.capability.reason, considered: decision.considered.map((c) => ({ provider: c.providerKey, canSend: c.capability.canSend, reason: c.capability.reason })) };
  if (!decision.provider) {
    const updated = await db.message.update({ where: { id: message.id }, data: { status: "UNAVAILABLE", providerKey: "manual", failureReason: "Message cannot be sent automatically: " + (decision.capability.reason ?? "no provider available"), meta: { decision: decisionMeta } as object } });
    await touchConversation(db, conversationId, updated);
    await writeAudit(db, { organizationId: ctx.organizationId, userId: ctx.userId ?? null, action: "message.requires_user", entityType: "Message", entityId: message.id, meta: decisionMeta });
    return { message: updated, conversationId, decision, send: { status: "REQUIRES_USER", providerKey: "manual", statusTracking: false, error: decision.capability.reason }, job: null, openUrl };
  }
  const send = await decision.provider.sendMessage({ organizationId: ctx.organizationId, messageId: message.id, conversationId, target: { ...target, decisionReason: decision.capability.reason } as MessageJobTarget, text: message.body }, { db, organizationId: ctx.organizationId });
  const job = send.jobId ? await db.messageJob.findUnique({ where: { id: send.jobId } }) : null;
  const status = send.status === "SENT" ? "SENT" : send.status === "QUEUED" ? "QUEUED" : send.status === "FAILED" ? "FAILED" : "UNAVAILABLE";
  const updated = await db.message.update({
    where: { id: message.id },
    data: { status, providerKey: send.providerKey, providerMessageId: send.providerMessageId ?? null, failureReason: send.error ?? null, sentAt: status === "SENT" ? new Date() : null, meta: { decision: decisionMeta, statusTracking: send.statusTracking } as object },
  });
  await touchConversation(db, conversationId, updated);
  await writeAudit(db, { organizationId: ctx.organizationId, userId: ctx.userId ?? null, actorType: message.authorType === "AI" ? "AI" : "USER", action: status === "QUEUED" ? "message.queued" : status === "SENT" ? "message.sent" : "message.send_failed", entityType: "Message", entityId: message.id, meta: { provider: send.providerKey, jobId: send.jobId ?? null } });
  if (status === "SENT") await afterSent(db, ctx, updated, client, send.providerKey);
  return { message: updated, conversationId, decision, send, job, openUrl };
}

async function afterSent(db: DbClient, ctx: RequestContext, message: Message, client: Client, providerKey: string): Promise<void> {
  await db.client.update({ where: { id: client.id }, data: { lastContactedAt: new Date(), lastActivityAt: new Date(), status: client.status === "NEW" ? "CONTACTED" : client.status } });
  await db.activity.create({ data: { organizationId: ctx.organizationId, clientId: client.id, type: "message.sent", title: `Message sent via ${providerKey}`, description: message.body.slice(0, 300), actorType: message.authorType === "AI" ? "AI" : "USER", userId: ctx.userId ?? null, meta: { messageId: message.id, channel: message.channel } as object } });
  await recordUsage(db, ctx.organizationId, "MESSAGES_SENT", 1);
}

/** Approve a PENDING_APPROVAL message and dispatch it. */
export async function approveMessage(db: DbClient, ctx: RequestContext, messageId: string, delivery: "manual" | "automation" = "automation"): Promise<OutboundResult> {
  const message = await db.message.findFirst({ where: { id: messageId, organizationId: ctx.organizationId } });
  if (!message) throw new NotFoundError("Message");
  if (message.status !== "PENDING_APPROVAL") throw new ConflictError("Message is not awaiting approval");
  const client = await db.client.findFirstOrThrow({ where: { id: message.clientId } });
  await assertContactable(client);
  await checkRateLimit(db, ctx.organizationId);
  const approved = await db.message.update({ where: { id: messageId }, data: { approvalStatus: "APPROVED", approvedByUserId: ctx.userId ?? null, approvedAt: new Date(), status: "DRAFT" } });
  await writeAudit(db, { organizationId: ctx.organizationId, userId: ctx.userId ?? null, action: "message.approved", entityType: "Message", entityId: messageId });
  const account = await findSocialAccount(db, ctx.organizationId, client.id, message.channel);
  const settings = await getOrCreateSettings(db, ctx.organizationId);
  return dispatchMessage(db, ctx, approved, message.conversationId, account, client, delivery, settings.preferredProvider as PreferredProvider);
}

export async function rejectMessage(db: DbClient, ctx: RequestContext, messageId: string): Promise<Message> {
  const message = await db.message.findFirst({ where: { id: messageId, organizationId: ctx.organizationId } });
  if (!message) throw new NotFoundError("Message");
  const updated = await db.message.update({ where: { id: messageId }, data: { approvalStatus: "REJECTED", status: "CANCELLED" } });
  await writeAudit(db, { organizationId: ctx.organizationId, userId: ctx.userId ?? null, action: "message.rejected", entityType: "Message", entityId: messageId });
  return updated;
}

/** Resolve the wall-clock time chosen by the user into a UTC instant using the requested timezone mode. */
export async function resolveScheduleInstant(db: DbClient, organizationId: string, client: Client, input: Pick<ScheduleMessageInput, "scheduledAt" | "timezone" | "timezoneMode">): Promise<{ at: Date; timezone: string }> {
  const org = await db.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { timezone: true } });
  const settings = await getOrCreateSettings(db, organizationId);
  const wh = parseWorkingHours(settings.workingHours);
  let timezone: string;
  if (input.timezoneMode === "custom") timezone = input.timezone ?? wh.customTimezone ?? org.timezone;
  else if (input.timezoneMode === "exporter") timezone = org.timezone;
  else timezone = client.timezone ?? input.timezone ?? org.timezone;
  if (!isValidTimeZone(timezone)) timezone = "UTC";
  const iso = input.scheduledAt.trim();
  if (/Z$|[+-]\d{2}:\d{2}$/.test(iso)) return { at: new Date(iso), timezone };
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso);
  if (!m) throw new AppError("INVALID_DATETIME", "scheduledAt must be an ISO datetime", { status: 400 });
  const at = zonedTimeToUtc({ year: Number(m[1]), month: Number(m[2]), day: Number(m[3]), hour: Number(m[4]), minute: Number(m[5]) }, timezone);
  return { at, timezone };
}

export async function scheduleMessage(db: DbClient, ctx: RequestContext, input: ScheduleMessageInput & { createdByType?: "USER" | "AI"; campaignId?: string | null; campaignLeadId?: string | null; followUpStep?: number | null; approvalRequired?: boolean }) {
  const client = await db.client.findFirst({ where: { id: input.clientId, organizationId: ctx.organizationId } });
  if (!client) throw new NotFoundError("Client");
  await assertContactable(client);
  const { at, timezone } = await resolveScheduleInstant(db, ctx.organizationId, client, input);
  if (at.getTime() < Date.now() - 60_000) throw new AppError("PAST_DATETIME", "Scheduled time is in the past", { status: 400 });
  const account = await findSocialAccount(db, ctx.organizationId, client.id, input.channel);
  const conversation = input.conversationId
    ? await db.conversation.findFirstOrThrow({ where: { id: input.conversationId, organizationId: ctx.organizationId } })
    : await getOrCreateConversation(db, { organizationId: ctx.organizationId, clientId: client.id, channel: input.channel, clientSocialAccountId: account?.id ?? null, campaignId: input.campaignId ?? null });
  const scheduled = await db.scheduledMessage.create({
    data: {
      organizationId: ctx.organizationId,
      clientId: client.id,
      conversationId: conversation.id,
      channel: input.channel,
      body: input.body,
      scheduledAt: at,
      timezone,
      timezoneMode: input.timezoneMode,
      status: input.approvalRequired ? "PENDING_APPROVAL" : "SCHEDULED",
      createdByType: input.createdByType ?? "USER",
      createdByUserId: ctx.userId ?? null,
      campaignId: input.campaignId ?? null,
      campaignLeadId: input.campaignLeadId ?? null,
      followUpStep: input.followUpStep ?? null,
      aiActionLogId: input.aiActionLogId ?? null,
    },
  });
  await writeAudit(db, { organizationId: ctx.organizationId, userId: ctx.userId ?? null, actorType: input.createdByType === "AI" ? "AI" : "USER", action: "message.scheduled", entityType: "ScheduledMessage", entityId: scheduled.id, meta: { scheduledAt: at.toISOString(), timezone } });
  await db.activity.create({ data: { organizationId: ctx.organizationId, clientId: client.id, type: "message.scheduled", title: `Message scheduled for ${at.toISOString()}`, actorType: input.createdByType === "AI" ? "AI" : "USER", userId: ctx.userId ?? null, meta: { scheduledMessageId: scheduled.id, timezone } as object } });
  return scheduled;
}

export async function cancelScheduledMessage(db: DbClient, ctx: RequestContext, id: string): Promise<void> {
  const res = await db.scheduledMessage.updateMany({ where: { id, organizationId: ctx.organizationId, status: { in: ["SCHEDULED", "PENDING_APPROVAL"] } }, data: { status: "CANCELLED", cancelledAt: new Date() } });
  if (!res.count) throw new NotFoundError("Scheduled message");
  await writeAudit(db, { organizationId: ctx.organizationId, userId: ctx.userId ?? null, action: "message.schedule_cancelled", entityType: "ScheduledMessage", entityId: id });
}

export interface JobResultInput {
  status: Extract<MessageJobStatus, "SENT" | "FAILED" | "BLOCKED" | "REQUIRES_USER" | "RETRYING" | "CANCELLED">;
  errorCode?: string | null;
  errorMessage?: string | null;
  errorClass?: ErrorClass | null;
  providerMessageId?: string | null;
  externalThreadId?: string | null;
  result?: Record<string, unknown> | null;
  retryAt?: Date | null;
}

/** Apply a delivery job outcome to the job, the message, the conversation and the client. */
export async function recordJobResult(db: DbClient, jobId: string, input: JobResultInput): Promise<MessageJob> {
  const job = await db.messageJob.findUniqueOrThrow({ where: { id: jobId } });
  const now = new Date();
  const terminal = input.status !== "RETRYING";
  const updatedJob = await db.messageJob.update({
    where: { id: jobId },
    data: {
      status: input.status,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
      errorClass: input.errorClass ?? null,
      result: input.result ? (input.result as object) : undefined,
      completedAt: terminal ? now : null,
      claimedByDeviceId: terminal ? job.claimedByDeviceId : null,
      leaseExpiresAt: null,
      scheduledAt: input.status === "RETRYING" && input.retryAt ? input.retryAt : job.scheduledAt,
      ...(input.status === "RETRYING" ? { status: "QUEUED" as MessageJobStatus } : {}),
    },
  });
  const message = await db.message.findUnique({ where: { id: job.messageId } });
  if (!message) return updatedJob;
  const ctx: RequestContext = { organizationId: job.organizationId, userId: message.userId };
  if (input.status === "SENT") {
    const sent = await db.message.update({ where: { id: message.id }, data: { status: "SENT", sentAt: now, providerMessageId: input.providerMessageId ?? message.providerMessageId, failureReason: null } });
    if (input.externalThreadId) {
      await db.conversation.updateMany({ where: { id: job.conversationId, externalThreadId: null }, data: { externalThreadId: input.externalThreadId } });
      const target = job.target as unknown as MessageJobTarget;
      if (target.clientSocialAccountId) await db.clientSocialAccount.updateMany({ where: { id: target.clientSocialAccountId, externalThreadId: null }, data: { externalThreadId: input.externalThreadId } });
    }
    const client = await db.client.findUniqueOrThrow({ where: { id: job.clientId } });
    await afterSent(db, ctx, sent, client, job.provider.toLowerCase());
    await db.conversation.update({ where: { id: job.conversationId }, data: { lastOutboundAt: now, lastMessageAt: now } });
    await writeAudit(db, { organizationId: job.organizationId, actorType: "SYSTEM", action: "message.sent", entityType: "Message", entityId: message.id, meta: { provider: job.provider, jobId } });
  } else if (input.status === "RETRYING") {
    await db.message.update({ where: { id: message.id }, data: { status: "QUEUED", failureReason: input.errorMessage ?? null } });
  } else {
    const status = input.status === "REQUIRES_USER" || input.status === "BLOCKED" ? "UNAVAILABLE" : input.status === "CANCELLED" ? "CANCELLED" : "FAILED";
    await db.message.update({ where: { id: message.id }, data: { status, failedAt: now, failureReason: input.errorMessage ?? input.errorCode ?? input.status, errorClass: input.errorClass ?? null } });
    await db.activity.create({ data: { organizationId: job.organizationId, clientId: job.clientId, type: "message.failed", title: `Automated send ${input.status.toLowerCase()} (${job.provider.toLowerCase()})`, description: input.errorMessage ?? input.errorCode ?? null, actorType: "SYSTEM", meta: { messageId: message.id, jobId } as object } });
    await writeAudit(db, { organizationId: job.organizationId, actorType: "SYSTEM", action: "message.failed", entityType: "Message", entityId: message.id, meta: { provider: job.provider, jobId, status: input.status, errorCode: input.errorCode } });
  }
  return updatedJob;
}

/** Record a message the user sent (or received) outside OSES J so the conversation stays complete. */
export async function logManualMessage(db: DbClient, ctx: RequestContext, input: { conversationId: string; direction: "INBOUND" | "OUTBOUND"; body: string; sentAt?: Date }): Promise<Message> {
  const conv = await db.conversation.findFirst({ where: { id: input.conversationId, organizationId: ctx.organizationId } });
  if (!conv) throw new NotFoundError("Conversation");
  const message = await db.message.create({
    data: {
      organizationId: ctx.organizationId,
      conversationId: conv.id,
      clientId: conv.clientId,
      channel: conv.channel,
      direction: input.direction,
      authorType: input.direction === "INBOUND" ? "CLIENT" : "USER",
      userId: ctx.userId ?? null,
      body: input.body,
      status: "SENT",
      providerKey: "manual",
      sentAt: input.sentAt ?? new Date(),
      meta: { manualLog: true } as object,
    },
  });
  await touchConversation(db, conv.id, message);
  if (input.direction === "INBOUND") {
    await db.client.update({ where: { id: conv.clientId }, data: { lastReplyAt: message.sentAt, lastActivityAt: message.sentAt, status: "REPLIED" } });
  } else {
    await db.client.update({ where: { id: conv.clientId }, data: { lastContactedAt: message.sentAt, lastActivityAt: message.sentAt } });
  }
  return message;
}
