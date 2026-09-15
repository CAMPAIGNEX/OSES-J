import { createAIProvider } from "@oses/ai";
import { ApifyClient } from "@oses/apify";
import { getPlatformConfig } from "@oses/database";
import { googleCseSearch } from "@oses/discovery";
import { graphRequest } from "@oses/messaging";
import { aiProviderConfigured, errorMessage } from "@oses/shared";
import { platformTestSchema } from "@oses/validation";
import { withApi } from "@/lib/server/api";

/**
 * Connection tests for platform providers. Inline values (a token typed but not yet saved) are tested
 * when present; otherwise the effective configuration (saved row, then environment fallback) is used.
 * Nothing is stored and nothing is written to the audit log: this is read-only against the vendor.
 */
export const POST = withApi(
  async (ctx) => {
    const b = ctx.body;
    const platform = await getPlatformConfig(ctx.db);
    const started = Date.now();
    try {
      if (b.target === "apify") {
        const token = b.apifyToken || platform.apify.token;
        if (!token) return { ok: false, error: "No Apify token to test" };
        const me = await new ApifyClient({ token }).getMe();
        return { ok: true, detail: `Connected as ${me.username}${me.plan ? ` (${me.plan} plan)` : ""}`, source: b.apifyToken ? "typed" : platform.apify.origin, durationMs: Date.now() - started };
      }
      if (b.target === "ai") {
        const settings = b.ai
          ? { provider: b.ai.provider, apiKey: b.ai.apiKey || (platform.ai.provider === b.ai.provider ? platform.ai.apiKey : null), model: b.ai.model ?? null, baseUrl: b.ai.baseUrl ?? null }
          : platform.ai.provider !== "none"
            ? { provider: platform.ai.provider, apiKey: platform.ai.apiKey, model: platform.ai.model, baseUrl: platform.ai.baseUrl }
            : null;
        if (!settings || !aiProviderConfigured(settings.provider, settings.apiKey)) return { ok: false, error: "No AI provider and key to test" };
        const provider = createAIProvider(settings);
        if (!provider) return { ok: false, error: "Unknown AI provider" };
        const result = await provider.generate({ system: "You are a connectivity check. Reply with the single word OK.", messages: [{ role: "user", content: "ping" }], maxTokens: 8, temperature: 0, purpose: "platform-test" });
        return { ok: true, detail: `${result.provider} · ${result.model} answered in ${result.durationMs} ms (${result.usage.inputTokens}+${result.usage.outputTokens} tokens)`, source: b.ai ? "typed" : platform.ai.origin, durationMs: Date.now() - started };
      }
      if (b.target === "google") {
        const apiKey = b.google?.apiKey || platform.google.apiKey;
        const cseId = b.google?.cseId || platform.google.cseId;
        if (!apiKey || !cseId) return { ok: false, error: "No Google API key and search engine id to test" };
        // One real query (counts against the 100 free per day) proves key, engine id and site access at once.
        const items = await googleCseSearch({ apiKey, cseId }, 'site:instagram.com "apparel"', { num: 3 });
        return { ok: true, detail: `Google answered with ${items.length} result${items.length === 1 ? "" : "s"}${items[0]?.link ? ` (first: ${items[0].link})` : ""}`, source: b.google ? "typed" : platform.google.origin, durationMs: Date.now() - started };
      }
      const appId = b.meta?.appId || platform.meta.appId;
      const appSecret = b.meta?.appSecret || (b.meta?.appId && b.meta.appId !== platform.meta.appId ? null : platform.meta.appSecret);
      if (!appId || !appSecret) return { ok: false, error: "No Meta app id and secret to test" };
      // An app access token is only issued for a valid id/secret pair; nothing else is touched.
      const res = await graphRequest<{ access_token?: string }>("/oauth/access_token", { query: { client_id: appId, client_secret: appSecret, grant_type: "client_credentials" } });
      return { ok: Boolean(res.access_token), detail: res.access_token ? `Meta app ${appId} credentials accepted` : "Meta did not return an app token", source: b.meta ? "typed" : platform.meta.origin, durationMs: Date.now() - started };
    } catch (err) {
      return { ok: false, error: errorMessage(err), durationMs: Date.now() - started };
    }
  },
  { body: platformTestSchema, superAdminOnly: true },
);
