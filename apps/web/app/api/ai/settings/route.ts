import { getOrCreateSettings, writeAudit } from "@oses/database";
import { decryptSecret, encryptSecret, getEnv, maskSecret } from "@oses/shared";
import { aiSettingsSchema } from "@oses/validation";
import { withApi } from "@/lib/server/api";

function view(s: Awaited<ReturnType<typeof getOrCreateSettings>>) {
  const env = getEnv();
  let keyPreview: string | null = null;
  if (s.aiApiKeyEncrypted) {
    try {
      keyPreview = maskSecret(decryptSecret(s.aiApiKeyEncrypted, env.ENCRYPTION_KEY));
    } catch {
      keyPreview = "(unreadable)";
    }
  }
  return {
    provider: s.aiProvider ?? "platform_default",
    model: s.aiModel,
    baseUrl: s.aiBaseUrl,
    hasApiKey: Boolean(s.aiApiKeyEncrypted),
    apiKeyPreview: keyPreview,
    platformDefault: env.AI_PROVIDER !== "none" && env.AI_API_KEY ? { provider: env.AI_PROVIDER, model: env.AI_MODEL ?? null } : null,
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

export const GET = withApi(async (ctx) => ({ settings: view(await getOrCreateSettings(ctx.db, ctx.organizationId)) }));

export const PUT = withApi(
  async (ctx) => {
    const env = getEnv();
    const b = ctx.body;
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
    return { settings: view(updated) };
  },
  { body: aiSettingsSchema, adminOnly: true },
);
