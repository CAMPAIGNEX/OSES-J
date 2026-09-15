import { buildPlatformConfig, getOrCreatePlatformSettings, invalidatePlatformConfig, type PlatformSettings } from "@oses/database";
import { aiProviderConfigured, decryptSecret, encryptSecret, getEnv, maskSecret } from "@oses/shared";
import { platformSettingsSchema } from "@oses/validation";
import { withApi } from "@/lib/server/api";
import { osAudit } from "@/lib/server/os-panel";

function preview(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    return maskSecret(decryptSecret(payload, getEnv().ENCRYPTION_KEY));
  } catch {
    return "(unreadable — ENCRYPTION_KEY changed)";
  }
}

/**
 * Operator view of the platform row: previews instead of secrets, plus what is effectively in use
 * (row value, environment fallback or nothing) so operators can see at a glance what workspaces get.
 */
function view(row: PlatformSettings) {
  const env = getEnv();
  const effective = buildPlatformConfig(row);
  return {
    updatedAt: row.updatedAt,
    updatedByUserId: row.updatedByUserId,
    apify: {
      enabled: row.apifyEnabled,
      hasToken: Boolean(row.apifyTokenEncrypted),
      tokenPreview: preview(row.apifyTokenEncrypted),
      effective: { configured: Boolean(effective.apify.token), origin: effective.apify.origin, preview: effective.apify.token ? maskSecret(effective.apify.token) : null },
      environmentFallback: Boolean(env.APIFY_API_TOKEN),
    },
    ai: {
      provider: row.aiProvider ?? "",
      model: row.aiModel,
      baseUrl: row.aiBaseUrl,
      hasApiKey: Boolean(row.aiApiKeyEncrypted),
      apiKeyPreview: preview(row.aiApiKeyEncrypted),
      effective: { provider: effective.ai.provider, model: effective.ai.model, origin: effective.ai.origin, configured: effective.ai.configured },
      environmentFallback: env.AI_PROVIDER !== "none" && aiProviderConfigured(env.AI_PROVIDER, env.AI_API_KEY) ? `${env.AI_PROVIDER}${env.AI_MODEL ? ` (${env.AI_MODEL})` : ""}` : null,
    },
    embeddings: {
      provider: row.embeddingProvider ?? "",
      model: row.embeddingModel,
      hasApiKey: Boolean(row.embeddingApiKeyEncrypted),
      apiKeyPreview: preview(row.embeddingApiKeyEncrypted),
      effective: { provider: effective.embeddings.provider, model: effective.embeddings.model, origin: effective.embeddings.origin, configured: effective.embeddings.provider !== "none" && Boolean(effective.embeddings.apiKey) },
      environmentFallback: env.AI_EMBEDDING_PROVIDER === "openai" && Boolean(env.AI_EMBEDDING_API_KEY || (env.AI_PROVIDER === "openai" && env.AI_API_KEY)),
    },
    google: {
      cseId: row.googleCseId,
      hasApiKey: Boolean(row.googleApiKeyEncrypted),
      apiKeyPreview: preview(row.googleApiKeyEncrypted),
      effective: { configured: Boolean(effective.google.apiKey && effective.google.cseId), origin: effective.google.origin, cseId: effective.google.cseId },
      environmentFallback: Boolean(env.GOOGLE_API_KEY && env.GOOGLE_CSE_ID),
    },
    meta: {
      appId: row.metaAppId,
      hasAppSecret: Boolean(row.metaAppSecretEncrypted),
      appSecretPreview: preview(row.metaAppSecretEncrypted),
      webhookVerifyToken: row.metaWebhookVerifyToken,
      effective: { configured: Boolean(effective.meta.appId && effective.meta.appSecret), origin: effective.meta.origin, appId: effective.meta.appId, webhookConfigured: Boolean(effective.meta.webhookVerifyToken) },
      environmentFallback: Boolean(env.META_APP_ID && env.META_APP_SECRET),
      callbackUrl: `${env.APP_URL.replace(/\/$/, "")}/api/webhooks/meta`,
    },
  };
}

/** Platform-wide providers and keys (OS-Panel → Providers & keys). */
export const GET = withApi(async ({ db }) => ({ settings: view(await getOrCreatePlatformSettings(db)) }), { superAdminOnly: true });

/**
 * Update the platform row. Secrets are encrypted at rest; sending an empty string removes a value.
 * Only field names (never values) are written to the audit log.
 */
export const PUT = withApi(
  async (ctx) => {
    const env = getEnv();
    const b = ctx.body;
    await getOrCreatePlatformSettings(ctx.db);
    const data: Record<string, unknown> = { updatedByUserId: ctx.session.user.id };
    if (b.apifyToken !== undefined) data.apifyTokenEncrypted = b.apifyToken ? encryptSecret(b.apifyToken, env.ENCRYPTION_KEY) : null;
    if (b.apifyEnabled !== undefined) data.apifyEnabled = b.apifyEnabled;
    if (b.aiProvider !== undefined) data.aiProvider = b.aiProvider || null;
    if (b.aiModel !== undefined) data.aiModel = b.aiModel || null;
    if (b.aiBaseUrl !== undefined) data.aiBaseUrl = b.aiBaseUrl || null;
    if (b.aiApiKey !== undefined) data.aiApiKeyEncrypted = b.aiApiKey ? encryptSecret(b.aiApiKey, env.ENCRYPTION_KEY) : null;
    if (b.embeddingProvider !== undefined) data.embeddingProvider = b.embeddingProvider || null;
    if (b.embeddingModel !== undefined) data.embeddingModel = b.embeddingModel || null;
    if (b.embeddingApiKey !== undefined) data.embeddingApiKeyEncrypted = b.embeddingApiKey ? encryptSecret(b.embeddingApiKey, env.ENCRYPTION_KEY) : null;
    if (b.googleApiKey !== undefined) data.googleApiKeyEncrypted = b.googleApiKey ? encryptSecret(b.googleApiKey, env.ENCRYPTION_KEY) : null;
    if (b.googleCseId !== undefined) data.googleCseId = b.googleCseId || null;
    if (b.metaAppId !== undefined) data.metaAppId = b.metaAppId || null;
    if (b.metaAppSecret !== undefined) data.metaAppSecretEncrypted = b.metaAppSecret ? encryptSecret(b.metaAppSecret, env.ENCRYPTION_KEY) : null;
    if (b.metaWebhookVerifyToken !== undefined) data.metaWebhookVerifyToken = b.metaWebhookVerifyToken || null;
    const row = await ctx.db.platformSettings.update({ where: { id: "platform" }, data });
    invalidatePlatformConfig();
    const secretFields = ["apifyTokenEncrypted", "aiApiKeyEncrypted", "embeddingApiKeyEncrypted", "googleApiKeyEncrypted", "metaAppSecretEncrypted"];
    await osAudit(ctx, {
      action: "platform.settings_updated",
      entityType: "PlatformSettings",
      entityId: "platform",
      meta: { fields: Object.keys(data).filter((k) => k !== "updatedByUserId" && !secretFields.includes(k)), secretsChanged: secretFields.filter((k) => k in data).map((k) => k.replace("Encrypted", "")) },
    });
    return { settings: view(row) };
  },
  { body: platformSettingsSchema, superAdminOnly: true },
);
