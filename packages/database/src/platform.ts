import { createLogger, decryptSecret, getEnv } from "@oses/shared";
import type { PlatformSettings } from "../generated/prisma/client";
import type { DbClient } from "./client";

const log = createLogger("db.platform");

/** Id of the single platform_settings row. */
export const PLATFORM_SETTINGS_ID = "platform";

export type ConfigOrigin = "platform" | "environment";
export type PlatformAIProviderKey = "anthropic" | "openai" | "openai_compatible" | "none";

/**
 * Effective platform-wide configuration: what the OS-Panel row says, falling back to environment
 * variables for anything left empty. Every workspace uses this unless it has its own override.
 */
export interface PlatformConfig {
  apify: { token: string | null; enabled: boolean; origin: ConfigOrigin | null };
  ai: { provider: PlatformAIProviderKey; apiKey: string | null; model: string | null; baseUrl: string | null; origin: ConfigOrigin | null };
  embeddings: { provider: "openai" | "none"; apiKey: string | null; model: string | null; baseUrl: string | null; origin: ConfigOrigin | null };
  /** Google Programmable Search: the search-engine strategy without an Apify Actor (100 free queries a day). */
  google: { apiKey: string | null; cseId: string | null; origin: ConfigOrigin | null };
  meta: { appId: string | null; appSecret: string | null; webhookVerifyToken: string | null; origin: ConfigOrigin | null };
  updatedAt: Date | null;
}

const CACHE_TTL_MS = 15_000;
let cache: { value: PlatformConfig; expiresAt: number } | null = null;

/** Fetch (or create with defaults) the platform settings row. */
export async function getOrCreatePlatformSettings(db: DbClient): Promise<PlatformSettings> {
  const existing = await db.platformSettings.findUnique({ where: { id: PLATFORM_SETTINGS_ID } });
  if (existing) return existing;
  return db.platformSettings.upsert({ where: { id: PLATFORM_SETTINGS_ID }, create: { id: PLATFORM_SETTINGS_ID }, update: {} });
}

/** Drop the in-process cache (call after the OS-Panel writes the row). Other processes refresh within CACHE_TTL_MS. */
export function invalidatePlatformConfig(): void {
  cache = null;
}

function decryptOrNull(payload: string | null | undefined, key: string | undefined, label: string): string | null {
  if (!payload) return null;
  try {
    return decryptSecret(payload, key);
  } catch (err) {
    log.warn(`platform ${label} could not be decrypted (ENCRYPTION_KEY changed?); falling back to environment`, { error: (err as Error).message });
    return null;
  }
}

/** Merge the platform row with environment defaults; row values win when present. Cached briefly per process. */
export function buildPlatformConfig(row: PlatformSettings | null): PlatformConfig {
  const env = getEnv();
  const apifyToken = decryptOrNull(row?.apifyTokenEncrypted, env.ENCRYPTION_KEY, "Apify token");
  const aiKey = decryptOrNull(row?.aiApiKeyEncrypted, env.ENCRYPTION_KEY, "AI key");
  const embeddingKey = decryptOrNull(row?.embeddingApiKeyEncrypted, env.ENCRYPTION_KEY, "embedding key");
  const metaSecret = decryptOrNull(row?.metaAppSecretEncrypted, env.ENCRYPTION_KEY, "Meta app secret");
  const googleKey = decryptOrNull(row?.googleApiKeyEncrypted, env.ENCRYPTION_KEY, "Google API key");

  const google: PlatformConfig["google"] =
    googleKey && row?.googleCseId
      ? { apiKey: googleKey, cseId: row.googleCseId, origin: "platform" }
      : env.GOOGLE_API_KEY && env.GOOGLE_CSE_ID
        ? { apiKey: env.GOOGLE_API_KEY, cseId: env.GOOGLE_CSE_ID, origin: "environment" }
        : { apiKey: null, cseId: null, origin: null };

  const apify: PlatformConfig["apify"] = apifyToken
    ? { token: apifyToken, enabled: row?.apifyEnabled ?? true, origin: "platform" }
    : env.APIFY_API_TOKEN
      ? { token: env.APIFY_API_TOKEN, enabled: row?.apifyEnabled ?? true, origin: "environment" }
      : { token: null, enabled: row?.apifyEnabled ?? true, origin: null };

  const rowProvider = (row?.aiProvider ?? null) as PlatformAIProviderKey | null;
  let ai: PlatformConfig["ai"];
  if (rowProvider === "none") {
    ai = { provider: "none", apiKey: null, model: null, baseUrl: null, origin: "platform" };
  } else if (rowProvider && aiKey) {
    ai = { provider: rowProvider, apiKey: aiKey, model: row?.aiModel ?? null, baseUrl: row?.aiBaseUrl ?? null, origin: "platform" };
  } else if (env.AI_PROVIDER !== "none" && env.AI_API_KEY) {
    ai = { provider: env.AI_PROVIDER, apiKey: env.AI_API_KEY, model: env.AI_MODEL ?? null, baseUrl: env.AI_BASE_URL ?? null, origin: "environment" };
  } else {
    ai = { provider: "none", apiKey: null, model: null, baseUrl: null, origin: null };
  }

  let embeddings: PlatformConfig["embeddings"];
  if (row?.embeddingProvider === "none") {
    embeddings = { provider: "none", apiKey: null, model: null, baseUrl: null, origin: "platform" };
  } else if (row?.embeddingProvider === "openai" && (embeddingKey || (ai.provider === "openai" && ai.apiKey))) {
    // An explicit embedding key wins; otherwise reuse the OpenAI chat key.
    embeddings = { provider: "openai", apiKey: embeddingKey ?? ai.apiKey, model: row.embeddingModel ?? null, baseUrl: embeddingKey ? null : ai.baseUrl, origin: "platform" };
  } else if (env.AI_EMBEDDING_PROVIDER === "openai" && (env.AI_EMBEDDING_API_KEY || (env.AI_PROVIDER === "openai" && env.AI_API_KEY))) {
    embeddings = { provider: "openai", apiKey: env.AI_EMBEDDING_API_KEY ?? env.AI_API_KEY ?? null, model: env.AI_EMBEDDING_MODEL ?? null, baseUrl: env.AI_EMBEDDING_API_KEY ? null : (env.AI_BASE_URL ?? null), origin: "environment" };
  } else {
    embeddings = { provider: "none", apiKey: null, model: null, baseUrl: null, origin: null };
  }

  const meta: PlatformConfig["meta"] =
    row?.metaAppId && metaSecret
      ? { appId: row.metaAppId, appSecret: metaSecret, webhookVerifyToken: row.metaWebhookVerifyToken || env.META_WEBHOOK_VERIFY_TOKEN || null, origin: "platform" }
      : env.META_APP_ID && env.META_APP_SECRET
        ? { appId: env.META_APP_ID, appSecret: env.META_APP_SECRET, webhookVerifyToken: row?.metaWebhookVerifyToken || env.META_WEBHOOK_VERIFY_TOKEN || null, origin: "environment" }
        : { appId: null, appSecret: null, webhookVerifyToken: row?.metaWebhookVerifyToken || env.META_WEBHOOK_VERIFY_TOKEN || null, origin: null };

  return { apify, ai, embeddings, google, meta, updatedAt: row?.updatedAt ?? null };
}

/** Effective platform configuration (OS-Panel row merged with environment fallbacks), cached for a few seconds. */
export async function getPlatformConfig(db: DbClient): Promise<PlatformConfig> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  let row: PlatformSettings | null = null;
  try {
    row = await db.platformSettings.findUnique({ where: { id: PLATFORM_SETTINGS_ID } });
  } catch (err) {
    // A missing table (migration not applied yet) must not take the whole platform down: use env only.
    log.warn("platform settings unavailable; using environment defaults", { error: (err as Error).message });
  }
  const value = buildPlatformConfig(row);
  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}
