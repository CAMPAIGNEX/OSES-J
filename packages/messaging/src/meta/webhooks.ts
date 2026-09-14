import type { DbClient } from "@oses/database";
import { allocateClientCid, writeAudit } from "@oses/database";
import { createLogger, errorMessage, getEnv, type Platform } from "@oses/shared";
import { getOrCreateConversation, touchConversation } from "../conversation-service";
import { connectionToken } from "./connections";
import { getScopedUserProfile } from "./graph-client";

const log = createLogger("messaging.webhooks");

/** Subset of the Messenger Platform webhook payload that OSES-J consumes. */
export interface MetaWebhookPayload {
  object: string;
  entry?: Array<{
    id: string;
    time?: number;
    messaging?: MetaMessagingEvent[];
    standby?: MetaMessagingEvent[];
  }>;
}

export interface MetaMessagingEvent {
  sender?: { id: string };
  recipient?: { id: string };
  timestamp?: number;
  message?: { mid?: string; text?: string; is_echo?: boolean; attachments?: Array<{ type?: string; payload?: { url?: string } }>; is_deleted?: boolean };
  delivery?: { mids?: string[]; watermark?: number };
  read?: { watermark?: number };
  postback?: { title?: string; payload?: string; mid?: string };
}

export interface WebhookProcessSummary {
  received: number;
  inboundMessages: number;
  echoes: number;
  statusUpdates: number;
  ignored: number;
  duplicates: number;
  /** Conversation ids that received a new inbound message (the automation layer triggers AI on these). */
  inboundConversationIds: string[];
  errors: string[];
}

export function handleVerification(query: URLSearchParams): { ok: boolean; challenge?: string } {
  const env = getEnv();
  const mode = query.get("hub.mode");
  const token = query.get("hub.verify_token");
  const challenge = query.get("hub.challenge");
  if (mode === "subscribe" && env.META_WEBHOOK_VERIFY_TOKEN && token === env.META_WEBHOOK_VERIFY_TOKEN && challenge) return { ok: true, challenge };
  return { ok: false };
}

function platformOf(object: string): Platform | null {
  if (object === "instagram") return "INSTAGRAM";
  if (object === "page") return "FACEBOOK";
  return null;
}

/**
 * Process a verified webhook payload idempotently.
 * Every message id (mid) is recorded in WebhookEvent (unique per provider) so redeliveries are ignored.
 */
export async function processMetaWebhook(db: DbClient, payload: MetaWebhookPayload): Promise<WebhookProcessSummary> {
  const summary: WebhookProcessSummary = { received: 0, inboundMessages: 0, echoes: 0, statusUpdates: 0, ignored: 0, duplicates: 0, inboundConversationIds: [], errors: [] };
  const platform = platformOf(payload.object);
  if (!platform) {
    summary.ignored++;
    return summary;
  }
  for (const entry of payload.entry ?? []) {
    const events = [...(entry.messaging ?? []), ...(entry.standby ?? [])];
    for (const event of events) {
      summary.received++;
      try {
        await processEvent(db, platform, entry.id, event, summary);
      } catch (err) {
        summary.errors.push(errorMessage(err));
        log.error("webhook event failed", { platform, entryId: entry.id, error: errorMessage(err) });
      }
    }
  }
  return summary;
}

async function processEvent(db: DbClient, platform: Platform, entryId: string, event: MetaMessagingEvent, summary: WebhookProcessSummary): Promise<void> {
  const senderId = event.sender?.id;
  const recipientId = event.recipient?.id;
  if (!senderId || !recipientId) {
    summary.ignored++;
    return;
  }
  // Delivery / read receipts refer to messages we sent.
  if (event.delivery || event.read) {
    const connection = await db.socialConnection.findFirst({ where: { platform, provider: "meta", OR: [{ externalAccountId: recipientId }, { pageId: recipientId }, { externalAccountId: entryId }] } });
    if (!connection) {
      summary.ignored++;
      return;
    }
    if (event.delivery?.mids?.length) {
      await db.message.updateMany({ where: { organizationId: connection.organizationId, channel: platform, providerMessageId: { in: event.delivery.mids }, deliveredAt: null }, data: { status: "DELIVERED", deliveredAt: new Date(event.delivery.watermark ?? Date.now()) } });
    } else if (event.delivery?.watermark) {
      await db.message.updateMany({ where: { organizationId: connection.organizationId, channel: platform, direction: "OUTBOUND", status: "SENT", sentAt: { lte: new Date(event.delivery.watermark) }, conversation: { clientSocialAccount: { scopedUserId: senderId } } }, data: { status: "DELIVERED", deliveredAt: new Date(event.delivery.watermark) } });
    }
    if (event.read?.watermark) {
      await db.message.updateMany({ where: { organizationId: connection.organizationId, channel: platform, direction: "OUTBOUND", status: { in: ["SENT", "DELIVERED"] }, sentAt: { lte: new Date(event.read.watermark) }, conversation: { clientSocialAccount: { scopedUserId: senderId } } }, data: { status: "SEEN", seenAt: new Date(event.read.watermark) } });
    }
    summary.statusUpdates++;
    return;
  }
  const message = event.message;
  if (!message?.mid) {
    summary.ignored++;
    return;
  }
  // Idempotency: one row per message id (the unique constraint also guards against concurrent redeliveries).
  const seen = await db.webhookEvent.findUnique({ where: { provider_externalEventId: { provider: "meta", externalEventId: message.mid } }, select: { id: true } });
  if (seen) {
    summary.duplicates++;
    return;
  }
  try {
    await db.webhookEvent.create({ data: { provider: "meta", externalEventId: message.mid, objectType: platform.toLowerCase(), payload: event as unknown as object, status: "RECEIVED" } });
  } catch {
    summary.duplicates++;
    return;
  }
  const isEcho = Boolean(message.is_echo);
  // For echoes the sender is our page/IG account; for inbound the recipient is.
  const ourAccountId = isEcho ? senderId : recipientId;
  const theirId = isEcho ? recipientId : senderId;
  const connection = await db.socialConnection.findFirst({ where: { platform, provider: "meta", OR: [{ externalAccountId: ourAccountId }, { pageId: ourAccountId }, { externalAccountId: entryId }, { pageId: entryId }] } });
  if (!connection) {
    await db.webhookEvent.update({ where: { provider_externalEventId: { provider: "meta", externalEventId: message.mid } }, data: { status: "IGNORED", error: "No matching social connection" } });
    summary.ignored++;
    return;
  }
  const organizationId = connection.organizationId;
  const text = message.text?.trim() || (message.attachments?.length ? `[${message.attachments.map((a) => a.type ?? "attachment").join(", ")}]` : "");
  if (!text) {
    await db.webhookEvent.update({ where: { provider_externalEventId: { provider: "meta", externalEventId: message.mid } }, data: { status: "IGNORED", error: "Empty message" } });
    summary.ignored++;
    return;
  }
  // Find or create the client + social account keyed by the scoped user id.
  let account = await db.clientSocialAccount.findFirst({ where: { organizationId, platform, scopedUserId: theirId }, include: { client: true } });
  if (!account) {
    const token = connectionToken(connection);
    const profile = token ? await getScopedUserProfile(theirId, token, platform) : { name: null, username: null };
    const existingByUsername = profile.username ? await db.clientSocialAccount.findFirst({ where: { organizationId, platform, username: profile.username.toLowerCase() }, include: { client: true } }) : null;
    if (existingByUsername) {
      account = await db.clientSocialAccount.update({ where: { id: existingByUsername.id }, data: { scopedUserId: theirId, messagingEligibility: "MESSAGEABLE", eligibilityReason: "Client messaged the connected account", eligibilityCheckedAt: new Date() }, include: { client: true } });
    } else {
      const brandName = profile.name ?? profile.username ?? `${platform === "INSTAGRAM" ? "Instagram" : "Facebook"} contact ${theirId.slice(-6)}`;
      const client = await db.$transaction(async (tx) => {
        const { cid, sequence } = await allocateClientCid(tx, organizationId);
        return tx.client.create({ data: { organizationId, cid, cidSequence: sequence, brandName, source: "meta_inbound", status: "REPLIED" } });
      });
      account = await db.clientSocialAccount.create({
        data: {
          organizationId,
          clientId: client.id,
          platform,
          username: profile.username?.toLowerCase() ?? null,
          profileUrl: profile.username ? (platform === "INSTAGRAM" ? `https://www.instagram.com/${profile.username}/` : `https://www.facebook.com/${profile.username}`) : `https://www.facebook.com/${theirId}`,
          scopedUserId: theirId,
          displayName: profile.name,
          messagingEligibility: "MESSAGEABLE",
          eligibilityReason: "Client messaged the connected account",
          eligibilityCheckedAt: new Date(),
          sourceProvider: "meta",
        },
        include: { client: true },
      });
      await writeAudit(db, { organizationId, actorType: "SYSTEM", action: "client.created", entityType: "Client", entityId: client.id, meta: { source: "meta_inbound", platform } });
    }
  } else if (account.messagingEligibility !== "MESSAGEABLE") {
    await db.clientSocialAccount.update({ where: { id: account.id }, data: { messagingEligibility: "MESSAGEABLE", eligibilityReason: "Client messaged the connected account", eligibilityCheckedAt: new Date() } });
  }
  const conversation = await getOrCreateConversation(db, { organizationId, clientId: account.clientId, channel: platform, clientSocialAccountId: account.id, socialConnectionId: connection.id, externalThreadId: `${connection.externalAccountId}:${theirId}` });
  const sentAt = new Date(event.timestamp ?? Date.now());
  try {
    const created = await db.message.create({
      data: {
        organizationId,
        conversationId: conversation.id,
        clientId: account.clientId,
        channel: platform,
        direction: isEcho ? "OUTBOUND" : "INBOUND",
        authorType: isEcho ? "USER" : "CLIENT",
        body: text,
        status: "SENT",
        providerKey: platform === "INSTAGRAM" ? "meta_instagram" : "meta_facebook",
        externalMessageId: message.mid,
        providerMessageId: isEcho ? message.mid : null,
        sentAt,
        meta: { attachments: message.attachments ?? [], echo: isEcho } as object,
      },
    });
    await touchConversation(db, conversation.id, created);
  } catch (err) {
    // unique (organizationId, channel, externalMessageId) -> already stored
    summary.duplicates++;
    log.debug("duplicate message ignored", { mid: message.mid, error: errorMessage(err) });
    return;
  }
  if (isEcho) {
    summary.echoes++;
    await db.client.update({ where: { id: account.clientId }, data: { lastContactedAt: sentAt, lastActivityAt: sentAt } });
  } else {
    summary.inboundMessages++;
    summary.inboundConversationIds.push(conversation.id);
    await db.client.update({ where: { id: account.clientId }, data: { lastReplyAt: sentAt, lastActivityAt: sentAt, status: account.client.status === "NEW" || account.client.status === "CONTACTED" ? "REPLIED" : account.client.status } });
    await db.activity.create({ data: { organizationId, clientId: account.clientId, type: "message.received", title: `Reply received on ${platform === "INSTAGRAM" ? "Instagram" : "Facebook"}`, description: text.slice(0, 300), actorType: "SYSTEM", meta: { conversationId: conversation.id } as object } });
  }
  await db.webhookEvent.update({ where: { provider_externalEventId: { provider: "meta", externalEventId: message.mid } }, data: { status: "PROCESSED", processedAt: new Date(), organizationId } });
}
