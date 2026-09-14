import type { DbClient } from "@oses/database";
import { ConfigurationError, createLogger, decryptSecret, getEnv } from "@oses/shared";
import { AnthropicProvider } from "./providers/anthropic";
import { OpenAICompatibleProvider, OpenAIEmbeddingProvider } from "./providers/openai-compatible";
import { DEFAULT_MODELS, type AIProvider, type AIProviderSettings, type EmbeddingProvider } from "./types";

const log = createLogger("ai.resolve");

export interface ResolvedAI {
  provider: AIProvider | null;
  settings: AIProviderSettings;
  origin: "organization" | "environment" | "none";
  temperature: number | null;
}

/** Build a provider from explicit settings (used by the resolver and by tests). */
export function createAIProvider(settings: AIProviderSettings): AIProvider | null {
  switch (settings.provider) {
    case "anthropic":
      return new AnthropicProvider({ apiKey: settings.apiKey ?? "", model: settings.model || DEFAULT_MODELS.anthropic });
    case "openai":
      return new OpenAICompatibleProvider({ key: "openai", apiKey: settings.apiKey ?? "", model: settings.model || DEFAULT_MODELS.openai, baseUrl: settings.baseUrl ?? undefined });
    case "openai_compatible":
      return new OpenAICompatibleProvider({ key: "openai_compatible", apiKey: settings.apiKey ?? "", model: settings.model ?? "", baseUrl: settings.baseUrl ?? undefined, supportsJsonSchema: false });
    default:
      return null;
  }
}

/**
 * Organization-level AI configuration (encrypted key in settings) overrides the platform default from env.
 * Returns provider = null when nothing is configured so callers can degrade gracefully.
 */
let testProvider: AIProvider | null | undefined;

/** Test hook: force a provider (or null) regardless of settings/env. */
export function setAIProviderForTests(provider: AIProvider | null | undefined): void {
  testProvider = provider;
}

export async function resolveAIProvider(db: DbClient, organizationId: string): Promise<ResolvedAI> {
  if (testProvider !== undefined) return { provider: testProvider, settings: { provider: testProvider ? "openai_compatible" : "none" }, origin: testProvider ? "environment" : "none", temperature: null };
  const env = getEnv();
  const settings = await db.organizationSettings.findUnique({
    where: { organizationId },
    select: { aiProvider: true, aiModel: true, aiBaseUrl: true, aiApiKeyEncrypted: true, aiTemperature: true },
  });
  const orgProvider = settings?.aiProvider as AIProviderSettings["provider"] | "platform_default" | null | undefined;
  if (orgProvider && orgProvider !== "platform_default" && orgProvider !== "none" && settings?.aiApiKeyEncrypted) {
    try {
      const apiKey = decryptSecret(settings.aiApiKeyEncrypted, env.ENCRYPTION_KEY);
      const s: AIProviderSettings = { provider: orgProvider, apiKey, model: settings.aiModel, baseUrl: settings.aiBaseUrl, temperature: settings.aiTemperature };
      return { provider: createAIProvider(s), settings: s, origin: "organization", temperature: settings.aiTemperature };
    } catch (err) {
      log.warn("organization AI key could not be decrypted; falling back to platform default", { organizationId, error: (err as Error).message });
    }
  }
  if (orgProvider === "none") return { provider: null, settings: { provider: "none" }, origin: "none", temperature: null };
  if (env.AI_PROVIDER !== "none" && env.AI_API_KEY) {
    const s: AIProviderSettings = { provider: env.AI_PROVIDER, apiKey: env.AI_API_KEY, model: env.AI_MODEL ?? null, baseUrl: env.AI_BASE_URL ?? null, temperature: settings?.aiTemperature ?? null };
    return { provider: createAIProvider(s), settings: s, origin: "environment", temperature: settings?.aiTemperature ?? null };
  }
  return { provider: null, settings: { provider: "none" }, origin: "none", temperature: null };
}

export async function requireAIProvider(db: DbClient, organizationId: string): Promise<ResolvedAI & { provider: AIProvider }> {
  const resolved = await resolveAIProvider(db, organizationId);
  if (!resolved.provider) {
    throw new ConfigurationError("AI is not configured. Add an AI provider and API key in Settings > AI (or set AI_PROVIDER / AI_API_KEY).");
  }
  return resolved as ResolvedAI & { provider: AIProvider };
}

export function resolveEmbeddingProvider(): EmbeddingProvider | null {
  const env = getEnv();
  if (env.AI_EMBEDDING_PROVIDER === "openai") {
    const apiKey = env.AI_EMBEDDING_API_KEY ?? (env.AI_PROVIDER === "openai" ? env.AI_API_KEY : undefined);
    if (!apiKey) return null;
    return new OpenAIEmbeddingProvider({ apiKey, model: env.AI_EMBEDDING_MODEL ?? undefined, baseUrl: env.AI_PROVIDER === "openai" ? env.AI_BASE_URL : undefined });
  }
  return null;
}
