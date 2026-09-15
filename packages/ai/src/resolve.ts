import { getPlatformConfig, type DbClient } from "@oses/database";
import { aiProviderConfigured, aiProviderPreset, ConfigurationError, createLogger, decryptSecret, getEnv } from "@oses/shared";
import { AnthropicProvider } from "./providers/anthropic";
import { OpenAICompatibleProvider, OpenAIEmbeddingProvider } from "./providers/openai-compatible";
import type { AIProvider, AIProviderSettings, EmbeddingProvider } from "./types";

const log = createLogger("ai.resolve");

export interface ResolvedAI {
  provider: AIProvider | null;
  settings: AIProviderSettings;
  origin: "organization" | "platform" | "environment" | "none";
  temperature: number | null;
}

/**
 * Build a provider from explicit settings (used by the resolver and by tests). Anthropic uses its own API;
 * every other catalogue entry (OpenAI, Gemini, Grok, DeepSeek, Qwen, Mistral, NVIDIA, Groq, Together,
 * OpenRouter, Ollama, LM Studio, custom) is an OpenAI-compatible endpoint at a preset base URL.
 */
export function createAIProvider(settings: AIProviderSettings): AIProvider | null {
  const preset = aiProviderPreset(settings.provider);
  if (!preset) return null;
  if (preset.api === "anthropic") return new AnthropicProvider({ apiKey: settings.apiKey ?? "", model: settings.model || preset.defaultModel });
  return new OpenAICompatibleProvider({
    key: preset.key,
    // Local servers accept any bearer value; a placeholder keeps the request shape valid.
    apiKey: settings.apiKey || (preset.keyOptional ? "local" : ""),
    model: settings.model || preset.defaultModel,
    baseUrl: settings.baseUrl || preset.baseUrl || undefined,
    supportsJsonSchema: preset.supportsJsonSchema,
  });
}

/**
 * Organization-level AI configuration (encrypted key in settings) overrides the platform default set by
 * operators in the OS-Panel (which itself falls back to AI_PROVIDER / AI_API_KEY from the environment).
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
  const orgProvider = settings?.aiProvider as string | null | undefined;
  if (settings && orgProvider && orgProvider !== "platform_default" && orgProvider !== "none" && (settings.aiApiKeyEncrypted || aiProviderConfigured(orgProvider, null))) {
    try {
      const apiKey = settings.aiApiKeyEncrypted ? decryptSecret(settings.aiApiKeyEncrypted, env.ENCRYPTION_KEY) : null;
      const s: AIProviderSettings = { provider: orgProvider, apiKey, model: settings.aiModel, baseUrl: settings.aiBaseUrl, temperature: settings.aiTemperature };
      return { provider: createAIProvider(s), settings: s, origin: "organization", temperature: settings.aiTemperature };
    } catch (err) {
      log.warn("organization AI key could not be decrypted; falling back to platform default", { organizationId, error: (err as Error).message });
    }
  }
  if (orgProvider === "none") return { provider: null, settings: { provider: "none" }, origin: "none", temperature: null };
  const platform = (await getPlatformConfig(db)).ai;
  if (platform.configured && platform.origin) {
    const s: AIProviderSettings = { provider: platform.provider, apiKey: platform.apiKey, model: platform.model, baseUrl: platform.baseUrl, temperature: settings?.aiTemperature ?? null };
    return { provider: createAIProvider(s), settings: s, origin: platform.origin, temperature: settings?.aiTemperature ?? null };
  }
  return { provider: null, settings: { provider: "none" }, origin: "none", temperature: null };
}

export async function requireAIProvider(db: DbClient, organizationId: string): Promise<ResolvedAI & { provider: AIProvider }> {
  const resolved = await resolveAIProvider(db, organizationId);
  if (!resolved.provider) {
    throw new ConfigurationError("AI is not configured for this workspace. The CNEX AI team activates it from the OS-Panel (Providers & keys).");
  }
  return resolved as ResolvedAI & { provider: AIProvider };
}

/** Embedding provider from the platform configuration (OS-Panel, falling back to AI_EMBEDDING_* env). */
export async function resolveEmbeddingProvider(db: DbClient): Promise<EmbeddingProvider | null> {
  const e = (await getPlatformConfig(db)).embeddings;
  if (e.provider !== "openai" || !e.apiKey) return null;
  return new OpenAIEmbeddingProvider({ apiKey: e.apiKey, model: e.model ?? undefined, baseUrl: e.baseUrl ?? undefined });
}
