import { afterEach, describe, expect, it } from "vitest";
import { buildPlatformConfig, type PlatformSettings } from "@oses/database";
import { encryptSecret, resetEnvCache } from "@oses/shared";

const KEY = process.env.ENCRYPTION_KEY;

function row(overrides: Partial<PlatformSettings> = {}): PlatformSettings {
  return {
    id: "platform",
    apifyTokenEncrypted: null,
    apifyEnabled: true,
    aiProvider: null,
    aiModel: null,
    aiBaseUrl: null,
    aiApiKeyEncrypted: null,
    embeddingProvider: null,
    embeddingModel: null,
    embeddingApiKeyEncrypted: null,
    googleApiKeyEncrypted: null,
    googleCseId: null,
    metaAppId: null,
    metaAppSecretEncrypted: null,
    metaWebhookVerifyToken: null,
    updatedByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function withEnv(values: Record<string, string>) {
  for (const [k, v] of Object.entries(values)) process.env[k] = v;
  resetEnvCache();
}

describe("platform configuration (OS-Panel row over environment fallback)", () => {
  afterEach(() => {
    withEnv({ APIFY_API_TOKEN: "", AI_PROVIDER: "none", AI_API_KEY: "", AI_MODEL: "", META_APP_ID: "", META_APP_SECRET: "", META_WEBHOOK_VERIFY_TOKEN: "", AI_EMBEDDING_PROVIDER: "none", GOOGLE_API_KEY: "", GOOGLE_CSE_ID: "" });
  });

  it("reports nothing configured when neither the row nor the environment has values", () => {
    const cfg = buildPlatformConfig(null);
    expect(cfg.apify).toEqual({ token: null, enabled: true, origin: null });
    expect(cfg.ai.provider).toBe("none");
    expect(cfg.ai.origin).toBeNull();
    expect(cfg.meta.appId).toBeNull();
  });

  it("falls back to environment variables and labels the origin", () => {
    withEnv({ APIFY_API_TOKEN: "apify_env", AI_PROVIDER: "openai", AI_API_KEY: "sk-env", AI_MODEL: "gpt-5", META_APP_ID: "123", META_APP_SECRET: "shh", META_WEBHOOK_VERIFY_TOKEN: "verify" });
    const cfg = buildPlatformConfig(null);
    expect(cfg.apify).toEqual({ token: "apify_env", enabled: true, origin: "environment" });
    expect(cfg.ai).toMatchObject({ provider: "openai", apiKey: "sk-env", model: "gpt-5", origin: "environment" });
    expect(cfg.meta).toMatchObject({ appId: "123", appSecret: "shh", webhookVerifyToken: "verify", origin: "environment" });
  });

  it("prefers the OS-Panel row over the environment and decrypts secrets", () => {
    withEnv({ APIFY_API_TOKEN: "apify_env", AI_PROVIDER: "openai", AI_API_KEY: "sk-env" });
    const cfg = buildPlatformConfig(
      row({
        apifyTokenEncrypted: encryptSecret("apify_panel", KEY),
        aiProvider: "anthropic",
        aiModel: "claude-opus-5",
        aiApiKeyEncrypted: encryptSecret("sk-ant-panel", KEY),
        metaAppId: "999",
        metaAppSecretEncrypted: encryptSecret("meta-secret", KEY),
        metaWebhookVerifyToken: "panel-verify",
      }),
    );
    expect(cfg.apify).toEqual({ token: "apify_panel", enabled: true, origin: "platform" });
    expect(cfg.ai).toEqual({ provider: "anthropic", apiKey: "sk-ant-panel", model: "claude-opus-5", baseUrl: null, origin: "platform", configured: true });
    expect(cfg.meta).toEqual({ appId: "999", appSecret: "meta-secret", webhookVerifyToken: "panel-verify", origin: "platform" });
  });

  it("lets operators switch discovery and AI off for the whole platform even when the environment has keys", () => {
    withEnv({ APIFY_API_TOKEN: "apify_env", AI_PROVIDER: "openai", AI_API_KEY: "sk-env" });
    const cfg = buildPlatformConfig(row({ apifyEnabled: false, aiProvider: "none" }));
    expect(cfg.apify).toEqual({ token: "apify_env", enabled: false, origin: "environment" });
    expect(cfg.ai).toMatchObject({ provider: "none", apiKey: null, origin: "platform" });
  });

  it("reuses the OpenAI chat key for embeddings when no embedding key is saved", () => {
    const cfg = buildPlatformConfig(row({ aiProvider: "openai", aiApiKeyEncrypted: encryptSecret("sk-chat", KEY), embeddingProvider: "openai", embeddingModel: "text-embedding-3-small" }));
    expect(cfg.embeddings).toEqual({ provider: "openai", apiKey: "sk-chat", model: "text-embedding-3-small", baseUrl: null, origin: "platform" });
  });

  it("treats local providers as configured without a key and rejects unknown provider keys", () => {
    expect(buildPlatformConfig(row({ aiProvider: "ollama", aiModel: "llama3.1", aiBaseUrl: "http://10.0.0.5:11434/v1" })).ai).toMatchObject({ provider: "ollama", apiKey: null, configured: true, origin: "platform" });
    expect(buildPlatformConfig(row({ aiProvider: "deepseek", aiApiKeyEncrypted: encryptSecret("sk-ds", KEY) })).ai).toMatchObject({ provider: "deepseek", apiKey: "sk-ds", configured: true });
    expect(buildPlatformConfig(row({ aiProvider: "deepseek" })).ai.configured).toBe(false);
    expect(buildPlatformConfig(row({ aiProvider: "not-a-provider", aiApiKeyEncrypted: encryptSecret("x", KEY) })).ai.configured).toBe(false);
  });
  it("reads the Google search API from the row before the environment", () => {
    withEnv({ GOOGLE_API_KEY: "env-key", GOOGLE_CSE_ID: "env-cx" });
    expect(buildPlatformConfig(null).google).toEqual({ apiKey: "env-key", cseId: "env-cx", origin: "environment" });
    expect(buildPlatformConfig(row({ googleApiKeyEncrypted: encryptSecret("panel-key", KEY), googleCseId: "panel-cx" })).google).toEqual({ apiKey: "panel-key", cseId: "panel-cx", origin: "platform" });
    withEnv({ GOOGLE_API_KEY: "", GOOGLE_CSE_ID: "" });
    expect(buildPlatformConfig(row({ googleCseId: "panel-cx" })).google.origin).toBeNull();
  });
  it("ignores a secret it cannot decrypt instead of failing", () => {
    withEnv({ APIFY_API_TOKEN: "apify_env" });
    const cfg = buildPlatformConfig(row({ apifyTokenEncrypted: "v1.garbage.garbage.garbage" }));
    expect(cfg.apify).toEqual({ token: "apify_env", enabled: true, origin: "environment" });
  });
});
