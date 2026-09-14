import type { MessageJobProvider } from "@oses/database";
import { getEnv, type Platform } from "@oses/shared";
import type { CapabilityResult, MessageJobPayload, MessageJobTarget, MessagingProvider, ProviderContext, SendMessageRequest, SendMessageResult } from "../types";

export const EXTENSION_ONLINE_WINDOW_MS = 120_000;

/**
 * Manual provider: the user sends the message themselves in Instagram/Facebook.
 * OSES J records the message and offers an "Open in Instagram" link; nothing is automated.
 */
export class ManualMessagingProvider implements MessagingProvider {
  readonly key = "manual";
  readonly label = "Manual (send it yourself)";
  readonly platforms: Platform[] = ["INSTAGRAM", "FACEBOOK"];

  async canSend(target: MessageTarget, _ctx: ProviderContext): Promise<CapabilityResult> {
    const hasTarget = Boolean(target.profileUrl || target.inboxUrl);
    return { canSend: hasTarget, eligibility: "REQUIRES_USER", reason: hasTarget ? "Message must be sent manually by the user" : "No profile or inbox URL for this client", requiresUser: true };
  }

  async sendMessage(request: SendMessageRequest, _ctx: ProviderContext): Promise<SendMessageResult> {
    return { status: "REQUIRES_USER", providerKey: this.key, statusTracking: false, error: null, externalThreadId: request.target.externalThreadId };
  }
}

type MessageTarget = MessageJobTarget;

/** Shared helper: create a MessageJob row for asynchronous providers (extension / Apify / Meta). */
export async function enqueueMessageJob(
  ctx: ProviderContext,
  provider: MessageJobProvider,
  request: SendMessageRequest,
  providerSettings: Record<string, unknown> = {},
  decisionReason: string | null = null,
): Promise<string> {
  const settings = await ctx.db.organizationSettings.findUnique({ where: { organizationId: ctx.organizationId }, select: { maxRetries: true } });
  const target: MessageJobTarget = { ...request.target, decisionReason };
  const payload: MessageJobPayload = { text: request.text, attachments: request.attachments, provider: providerSettings };
  const job = await ctx.db.messageJob.create({
    data: {
      organizationId: ctx.organizationId,
      messageId: request.messageId,
      conversationId: request.conversationId,
      clientId: request.target.clientId,
      provider,
      status: "QUEUED",
      target: target as unknown as object,
      payload: payload as unknown as object,
      priority: request.priority ?? 5,
      maxAttempts: Math.max(1, (settings?.maxRetries ?? 3)),
      scheduledAt: request.scheduledAt ?? new Date(),
    },
  });
  return job.id;
}

/**
 * Browser extension provider: the job is claimed by the user's Chrome extension, which performs the
 * UI action inside the user's own authenticated browser session.
 */
export class BrowserExtensionProvider implements MessagingProvider {
  readonly key = "extension";
  readonly label = "Browser extension";
  readonly platforms: Platform[] = ["INSTAGRAM", "FACEBOOK"];

  async canSend(target: MessageTarget, ctx: ProviderContext): Promise<CapabilityResult> {
    const settings = await ctx.db.organizationSettings.findUnique({ where: { organizationId: ctx.organizationId }, select: { extensionEnabled: true } });
    if (settings && !settings.extensionEnabled) return { canSend: false, eligibility: "REQUIRES_USER", reason: "Browser extension automation is disabled in settings", requiresUser: true };
    if (!target.username && !target.profileUrl) return { canSend: false, eligibility: "NOT_MESSAGEABLE", reason: "No username/profile URL for the extension to open", requiresUser: false };
    const since = new Date(Date.now() - EXTENSION_ONLINE_WINDOW_MS);
    const device = await ctx.db.extensionDevice.findFirst({ where: { organizationId: ctx.organizationId, status: "ONLINE", revokedAt: null, lastSeenAt: { gte: since } }, orderBy: { lastSeenAt: "desc" } });
    if (!device) return { canSend: false, eligibility: "REQUIRES_USER", reason: "No browser extension is connected right now", requiresUser: true };
    const caps = (device.capabilities as { loggedIn?: Record<string, boolean> } | null)?.loggedIn;
    const platformKey = target.platform.toLowerCase();
    if (caps && caps[platformKey] === false) return { canSend: false, eligibility: "REQUIRES_USER", reason: `The extension reports you are not logged in to ${target.platform === "INSTAGRAM" ? "Instagram" : "Facebook"}`, requiresUser: true };
    return { canSend: true, eligibility: "MESSAGEABLE", reason: "Browser extension is online", requiresUser: false };
  }

  async sendMessage(request: SendMessageRequest, ctx: ProviderContext): Promise<SendMessageResult> {
    const jobId = await enqueueMessageJob(ctx, "EXTENSION", request, {}, "extension online");
    return { status: "QUEUED", providerKey: this.key, jobId, statusTracking: false };
  }
}

/**
 * Apify provider: delegates the UI action to a configured Apify Actor (secondary automation option).
 * The Actor is executed by the job runner (see automation package); this provider only enqueues.
 */
export class ApifyMessagingProvider implements MessagingProvider {
  readonly key = "apify";
  readonly label = "Apify automation";
  readonly platforms: Platform[] = ["INSTAGRAM", "FACEBOOK"];

  async resolveConfig(ctx: ProviderContext, platform: Platform): Promise<{ actorId: string; settings: Record<string, unknown>; timeoutSec: number; adapter: string } | null> {
    const row = await ctx.db.providerConfig.findFirst({
      where: { domain: "MESSAGING", provider: "apify", enabled: true, platform: { in: [platform, "ANY"] }, OR: [{ organizationId: ctx.organizationId }, { organizationId: null }] },
      orderBy: [{ organizationId: "desc" }, { priority: "asc" }],
    });
    if (row) return { actorId: row.actorId, settings: (row.settings as Record<string, unknown> | null) ?? {}, timeoutSec: row.timeoutSec, adapter: row.adapter };
    const env = getEnv();
    const actorId = env.APIFY_MESSAGING_ACTOR ?? env.APIFY_INSTAGRAM_MESSAGE_ACTOR;
    if (actorId && platform === "INSTAGRAM") return { actorId, settings: {}, timeoutSec: env.APIFY_RUN_TIMEOUT_SEC, adapter: "generic-dm" };
    return null;
  }

  async canSend(target: MessageTarget, ctx: ProviderContext): Promise<CapabilityResult> {
    const settings = await ctx.db.organizationSettings.findUnique({ where: { organizationId: ctx.organizationId }, select: { apifyEnabled: true, apifyTokenEncrypted: true } });
    const env = getEnv();
    if (settings && !settings.apifyEnabled) return { canSend: false, eligibility: "REQUIRES_USER", reason: "Apify automation is disabled in settings", requiresUser: true };
    if (!settings?.apifyTokenEncrypted && !env.APIFY_API_TOKEN) return { canSend: false, eligibility: "REQUIRES_USER", reason: "Apify token is not configured", requiresUser: true };
    const cfg = await this.resolveConfig(ctx, target.platform);
    if (!cfg) return { canSend: false, eligibility: "REQUIRES_USER", reason: `No Apify messaging Actor configured for ${target.platform}`, requiresUser: true };
    if (!target.username && !target.inboxUrl && !target.externalThreadId) return { canSend: false, eligibility: "NOT_MESSAGEABLE", reason: "No username or thread reference for the Actor", requiresUser: false };
    return { canSend: true, eligibility: "MESSAGEABLE", reason: `Apify Actor ${cfg.actorId} configured`, requiresUser: false };
  }

  async sendMessage(request: SendMessageRequest, ctx: ProviderContext): Promise<SendMessageResult> {
    const cfg = await this.resolveConfig(ctx, request.target.platform);
    if (!cfg) return { status: "REQUIRES_USER", providerKey: this.key, statusTracking: false, error: "No Apify messaging Actor configured" };
    const jobId = await enqueueMessageJob(ctx, "APIFY", request, { actorId: cfg.actorId, adapter: cfg.adapter, timeoutSec: cfg.timeoutSec, settings: cfg.settings }, `apify actor ${cfg.actorId}`);
    return { status: "QUEUED", providerKey: this.key, jobId, statusTracking: false };
  }
}
