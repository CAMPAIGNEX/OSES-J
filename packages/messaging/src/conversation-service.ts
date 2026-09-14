import type { Conversation, DbClient, Message, Prisma } from "@oses/database";
import { NotFoundError, normalizePage, paginate, truncate, type Paginated, type Platform } from "@oses/shared";
import type { ConversationListQuery } from "@oses/validation";

export interface RequestContext {
  organizationId: string;
  userId?: string | null;
}

export async function getOrCreateConversation(
  db: DbClient,
  input: { organizationId: string; clientId: string; channel: Platform; clientSocialAccountId?: string | null; socialConnectionId?: string | null; externalThreadId?: string | null; campaignId?: string | null },
): Promise<Conversation> {
  if (input.externalThreadId) {
    const byThread = await db.conversation.findFirst({ where: { organizationId: input.organizationId, channel: input.channel, externalThreadId: input.externalThreadId } });
    if (byThread) return byThread;
  }
  const existing = await db.conversation.findFirst({
    where: { organizationId: input.organizationId, clientId: input.clientId, channel: input.channel, deletedAt: null, status: { not: "ARCHIVED" } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    const data: Prisma.ConversationUncheckedUpdateInput = {};
    if (input.externalThreadId && !existing.externalThreadId) data.externalThreadId = input.externalThreadId;
    if (input.socialConnectionId && !existing.socialConnectionId) data.socialConnectionId = input.socialConnectionId;
    if (input.clientSocialAccountId && !existing.clientSocialAccountId) data.clientSocialAccountId = input.clientSocialAccountId;
    if (Object.keys(data).length) return db.conversation.update({ where: { id: existing.id }, data });
    return existing;
  }
  return db.conversation.create({
    data: {
      organizationId: input.organizationId,
      clientId: input.clientId,
      channel: input.channel,
      clientSocialAccountId: input.clientSocialAccountId ?? null,
      socialConnectionId: input.socialConnectionId ?? null,
      externalThreadId: input.externalThreadId ?? null,
      campaignId: input.campaignId ?? null,
    },
  });
}

/** Keep conversation counters/preview in sync after a message is added or changes direction state. */
export async function touchConversation(db: DbClient, conversationId: string, message: Pick<Message, "direction" | "body" | "sentAt" | "createdAt" | "status">): Promise<void> {
  const at = message.sentAt ?? message.createdAt;
  const data: Prisma.ConversationUncheckedUpdateInput = {
    lastMessageAt: at,
    lastMessagePreview: truncate(message.body.replace(/\s+/g, " "), 300),
    messageCount: { increment: 1 },
  };
  if (message.direction === "INBOUND") {
    data.lastInboundAt = at;
    data.unreadCount = { increment: 1 };
  } else if (message.status === "SENT" || message.status === "DELIVERED" || message.status === "SEEN") {
    data.lastOutboundAt = at;
  }
  await db.conversation.update({ where: { id: conversationId }, data });
}

export type ConversationListItem = Prisma.ConversationGetPayload<{
  include: { client: { select: { id: true; cid: true; brandName: true; status: true; country: true; city: true; tags: { include: { tag: true } } } } };
}>;

export async function listConversations(db: DbClient, ctx: RequestContext, q: ConversationListQuery): Promise<Paginated<ConversationListItem>> {
  const page = normalizePage(q);
  const where: Prisma.ConversationWhereInput = { organizationId: ctx.organizationId, deletedAt: null };
  if (q.channel) where.channel = q.channel;
  if (q.status) where.status = q.status;
  else where.status = { not: "ARCHIVED" };
  if (q.unread) where.unreadCount = { gt: 0 };
  if (q.assignedUserId) where.assignedUserId = q.assignedUserId;
  if (q.aiStatus) where.aiStatus = q.aiStatus;
  if (q.clientStatus) where.client = { status: q.clientStatus as never };
  if (q.tag) where.client = { ...(where.client as object), tags: { some: { tag: { name: q.tag } } } };
  if (q.q) where.OR = [{ client: { brandName: { contains: q.q } } }, { client: { cid: { contains: q.q } } }, { lastMessagePreview: { contains: q.q } }];
  const [total, items] = await Promise.all([
    db.conversation.count({ where }),
    db.conversation.findMany({
      where,
      orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      skip: (page.page - 1) * page.pageSize,
      take: page.pageSize,
      include: { client: { select: { id: true, cid: true, brandName: true, status: true, country: true, city: true, tags: { include: { tag: true } } } } },
    }),
  ]);
  return paginate(items, total, page);
}

export type ConversationDetail = Prisma.ConversationGetPayload<{
  include: {
    client: { include: { socialAccounts: true; contacts: true; tags: { include: { tag: true } } } };
    messages: { orderBy: { createdAt: "asc" }; include: { attachments: true; job: true } };
    scheduledMessages: { where: { status: { in: ["SCHEDULED", "PENDING_APPROVAL", "QUEUED"] } }; orderBy: { scheduledAt: "asc" } };
    socialConnection: { select: { id: true; platform: true; username: true; displayName: true; status: true } };
  };
}>;

export async function getConversationDetail(db: DbClient, ctx: RequestContext, id: string): Promise<ConversationDetail> {
  const conv = await db.conversation.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: {
      client: { include: { socialAccounts: true, contacts: true, tags: { include: { tag: true } } } },
      messages: { orderBy: { createdAt: "asc" }, include: { attachments: true, job: true } },
      scheduledMessages: { where: { status: { in: ["SCHEDULED", "PENDING_APPROVAL", "QUEUED"] } }, orderBy: { scheduledAt: "asc" } },
      socialConnection: { select: { id: true, platform: true, username: true, displayName: true, status: true } },
    },
  });
  if (!conv) throw new NotFoundError("Conversation");
  return conv;
}

export async function markConversationRead(db: DbClient, ctx: RequestContext, id: string): Promise<void> {
  await db.conversation.updateMany({ where: { id, organizationId: ctx.organizationId }, data: { unreadCount: 0 } });
}

export async function updateConversation(db: DbClient, ctx: RequestContext, id: string, input: { status?: "OPEN" | "CLOSED" | "ARCHIVED"; assignedUserId?: string | null; needsHumanReview?: boolean; markRead?: boolean }): Promise<Conversation> {
  const conv = await db.conversation.findFirst({ where: { id, organizationId: ctx.organizationId } });
  if (!conv) throw new NotFoundError("Conversation");
  const data: Prisma.ConversationUncheckedUpdateInput = {};
  if (input.status) data.status = input.status;
  if (input.assignedUserId !== undefined) data.assignedUserId = input.assignedUserId;
  if (input.needsHumanReview !== undefined) {
    data.needsHumanReview = input.needsHumanReview;
    if (!input.needsHumanReview) data.needsHumanReason = null;
  }
  if (input.markRead) data.unreadCount = 0;
  return db.conversation.update({ where: { id }, data });
}

/** Load the message history shaped for the AI agent. */
export async function loadConversationForAI(db: DbClient, conversationId: string, limit = 40) {
  const conv = await db.conversation.findUniqueOrThrow({ where: { id: conversationId } });
  const messages = await db.message.findMany({ where: { conversationId, status: { notIn: ["DRAFT", "CANCELLED", "FAILED"] } }, orderBy: { createdAt: "desc" }, take: limit });
  return {
    channel: conv.channel,
    summary: conv.summary,
    messages: messages.reverse().map((m) => ({ direction: m.direction, authorType: m.authorType, body: m.body, sentAt: m.sentAt ?? m.createdAt })),
  };
}
