import { getOrCreateSettings, getPlatformConfig, writeAudit, type PlatformConfig } from "@oses/database";
import { aiProviderConfigured, decryptSecret, encryptSecret, ForbiddenError, getEnv, maskSecret } from "@oses/shared";
import { aiSettingsSchema } from "@oses/validation";
import { withApi } from "@/lib/server/api";

function view(s: Awaited<ReturnType<typeof getOrCreateSettings>>, operator: boolean, platform: PlatformConfig) {
  const env = getEnv();
  let keyPreview: string | null = null;
  if (s.aiApiKeyEncrypted && operator) {
    try {
      keyPreview = maskSecret(decryptSecret(s.aiApiKeyEncrypted, env.ENCRYPTION_KEY));
    } catch {
      keyPreview = "(unreadable)";
    }
  }
  const platformDefault = platform.ai.configured ? { provider: platform.ai.provider, model: platform.ai.model, origin: platform.ai.origin } : null;
  return {
    /** Whether AI features work for this workspace (own key or platform default) */
    ready: aiProviderConfigured(s.aiProvider, s.aiApiKeyEncrypted) || (s.aiProvider !== "none" && platformDefault !== null),
    provider: operator ? (s.aiProvider ?? "platform_default") : undefined,
    model: operator ? s.aiModel : undefined,
    baseUrl: operator ? s.aiBaseUrl : undefined,
    hasApiKey: Boolean(s.aiApiKeyEncrypted),
    apiKeyPreview: keyPreview,
    platformDefault: operator ? platformDefault : undefined,
    temperature: s.aiTemperature,
    tone: s.aiTone,
    language: s.aiLanguage,
    messagingMode: s.messagingMode,
    autopilotEnabled: s.autopilotEnabled,
    autopilotEnabledAt: s.autopilotEnabledAt,
    autoReply: s.autoReply,
    autoFollowUp: s.autoFollowUp,
    autoFirstMessage: s.autoFirstMessage,
    requireApprovalFirstMessage: s.requireApprovalFirstMessage,
    requireApprovalAttachments: s.requireApprovalAttachments,
    confidenceThreshold: s.confidenceThreshold,
    escalatePricing: s.escalatePricing,
    escalateNegotiation: s.escalateNegotiation,
    escalateComplaints: s.escalateComplaints,
    escalateUnusual: s.escalateUnusual,
  };
}

export const GET = withApi(async (ctx) => ({ settings: view(await getOrCreateSettings(ctx.db, ctx.organizationId), ctx.isOperator, await getPlatformConfig(ctx.db)) }), { operatorOrgOverride: true });

export const PUT = withApi(
  async (ctx) => {
    const env = getEnv();
    const b = ctx.body;
    // Provider, model, endpoint, key and temperature are managed by platform operators from the OS-Panel only.
    const operatorOnlyKeys = ["provider", "model", "baseUrl", "apiKey", "temperature"] as const;
    if (!ctx.isOperator && operatorOnlyKeys.some((k) => b[k] !== undefined)) throw new ForbiddenError("AI provider settings are managed by the CNEX AI team. Contact support to change them.");
    await getOrCreateSettings(ctx.db, ctx.organizationId);
    const data: Record<string, unknown> = {};
    if (b.provider !== undefined) data.aiProvider = b.provider === "platform_default" ? null : b.provider;
    if (b.model !== undefined) data.aiModel = b.model || null;
    if (b.baseUrl !== undefined) data.aiBaseUrl = b.baseUrl || null;
    if (b.apiKey !== undefined) data.aiApiKeyEncrypted = b.apiKey ? encryptSecret(b.apiKey, env.ENCRYPTION_KEY) : null;
    if (b.temperature !== undefined) data.aiTemperature = b.temperature;
    if (b.tone !== undefined) data.aiTone = b.tone || null;
    if (b.language !== undefined) data.aiLanguage = b.language || null;
    for (const k of ["autoReply", "autoFollowUp", "autoFirstMessage", "requireApprovalFirstMessage", "requireApprovalAttachments", "confidenceThreshold", "escalatePricing", "escalateNegotiation", "escalateComplaints", "escalateUnusual"] as const) {
      if (b[k] !== undefined) data[k] = b[k];
    }
    const updated = await ctx.db.organizationSettings.update({ where: { organizationId: ctx.organizationId }, data });
    await writeAudit(ctx.db, { organizationId: ctx.organizationId, userId: ctx.userId, action: "settings.ai_updated", meta: { fields: Object.keys(data).filter((k) => k !== "aiApiKeyEncrypted"), keyChanged: b.apiKey !== undefined } });
    return { settings: view(updated, ctx.isOperator, await getPlatformConfig(ctx.db)) };
  },
  { body: aiSettingsSchema, adminOnly: true, operatorOrgOverride: true },
);
