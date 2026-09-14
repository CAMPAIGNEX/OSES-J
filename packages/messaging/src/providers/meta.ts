import type { Platform } from "@oses/shared";
import { connectionToken } from "../meta/connections";
import { sendInstagramMessage, sendPageMessage } from "../meta/graph-client";
import type { CapabilityResult, MessageJobTarget, MessagingProvider, ProviderContext, SendMessageRequest, SendMessageResult } from "../types";
import { enqueueMessageJob } from "./basic";

/**
 * Official Meta messaging (Messenger Platform / Messenger API for Instagram).
 *
 * The official API can only message people who have already messaged the connected Page/Instagram
 * account (page-scoped ids exist only after that first inbound message). Cold outbound to arbitrary
 * profiles is not supported by Meta, so `canSend` reports NOT_MESSAGEABLE in that case instead of
 * pretending. Delivery/read receipts arrive through webhooks, so status tracking is real here.
 */
export class MetaMessagingProvider implements MessagingProvider {
  readonly key: string;
  readonly label: string;
  readonly platforms: Platform[];

  constructor(private readonly platform: Platform) {
    this.key = platform === "INSTAGRAM" ? "meta_instagram" : "meta_facebook";
    this.label = platform === "INSTAGRAM" ? "Instagram (official API)" : "Facebook Messenger (official API)";
    this.platforms = [platform];
  }

  async findConnection(ctx: ProviderContext, socialConnectionId: string | null) {
    if (socialConnectionId) {
      const c = await ctx.db.socialConnection.findFirst({ where: { id: socialConnectionId, organizationId: ctx.organizationId } });
      if (c) return c;
    }
    return ctx.db.socialConnection.findFirst({ where: { organizationId: ctx.organizationId, platform: this.platform, provider: "meta", status: "CONNECTED" }, orderBy: { updatedAt: "desc" } });
  }

  async canSend(target: MessageJobTarget, ctx: ProviderContext): Promise<CapabilityResult> {
    if (target.platform !== this.platform) return { canSend: false, eligibility: "NOT_MESSAGEABLE", reason: "Platform mismatch", requiresUser: false };
    const connection = await this.findConnection(ctx, target.socialConnectionId);
    if (!connection) return { canSend: false, eligibility: "REQUIRES_USER", reason: `No ${this.platform === "INSTAGRAM" ? "Instagram" : "Facebook"} account connected through Meta`, requiresUser: true };
    if (connection.status !== "CONNECTED" || !connection.accessTokenEncrypted) return { canSend: false, eligibility: "REQUIRES_USER", reason: "Meta connection needs to be reconnected", requiresUser: true };
    if (!target.scopedUserId) {
      return { canSend: false, eligibility: "NOT_MESSAGEABLE", reason: "The official Meta API can only reply to people who have messaged your connected account first", requiresUser: false };
    }
    return { canSend: true, eligibility: "MESSAGEABLE", reason: "Connected via Meta and the client has an existing thread", requiresUser: false };
  }

  async sendMessage(request: SendMessageRequest, ctx: ProviderContext): Promise<SendMessageResult> {
    const capability = await this.canSend(request.target, ctx);
    if (!capability.canSend) return { status: capability.requiresUser ? "REQUIRES_USER" : "NOT_MESSAGEABLE", providerKey: this.key, statusTracking: true, error: capability.reason };
    const jobId = await enqueueMessageJob(ctx, "META", request, { platform: this.platform }, "official Meta API");
    return { status: "QUEUED", providerKey: this.key, jobId, statusTracking: true };
  }

  /** Executed by the job runner: perform the Graph API call. */
  async deliver(ctx: ProviderContext, target: MessageJobTarget, text: string): Promise<{ providerMessageId: string; recipientId: string }> {
    const connection = await this.findConnection(ctx, target.socialConnectionId);
    if (!connection) throw new Error("Meta connection not found");
    const token = connectionToken(connection);
    if (!token) throw new Error("Meta connection token unavailable; reconnect the account");
    if (!target.scopedUserId) throw new Error("No scoped user id for recipient");
    const res =
      this.platform === "INSTAGRAM"
        ? await sendInstagramMessage(connection.externalAccountId, token, target.scopedUserId, text)
        : await sendPageMessage(connection.pageId ?? connection.externalAccountId, token, target.scopedUserId, text);
    return { providerMessageId: res.message_id, recipientId: res.recipient_id };
  }
}
