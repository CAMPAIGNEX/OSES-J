import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createLogger, ProviderError } from "@oses/shared";
import type { AIGenerateRequest, AIProvider, AIResult } from "../types";

const log = createLogger("ai.anthropic");

export interface AnthropicProviderOptions {
  apiKey: string;
  model?: string;
  /**
   * Server-side refusal fallbacks ("default" routes a policy decline to a fallback model in the same call).
   * Enabled by default; set to "off" to disable.
   */
  fallbacks?: "default" | "off";
  timeoutMs?: number;
}

/**
 * Claude via the official Anthropic SDK.
 *
 * Notes for current Claude models (Opus 5 / Sonnet 5 / 4.6+ family):
 * - thinking is adaptive; depth is steered with `output_config.effort`
 * - sampling parameters (temperature) are not accepted, so `request.temperature` is ignored
 * - assistant prefill is not available; JSON is obtained through structured outputs
 */
export class AnthropicProvider implements AIProvider {
  readonly key = "anthropic";
  readonly model: string;
  private readonly client: Anthropic;
  private readonly fallbacks: "default" | "off";

  constructor(options: AnthropicProviderOptions) {
    if (!options.apiKey) throw new ProviderError("anthropic", "Anthropic API key is not configured", { code: "AI_NOT_CONFIGURED", status: 503, errorClass: "USER_ACTION_REQUIRED" });
    this.client = new Anthropic({ apiKey: options.apiKey, timeout: options.timeoutMs ?? 120_000, maxRetries: 2 });
    this.model = options.model || "claude-opus-5";
    this.fallbacks = options.fallbacks ?? "default";
  }

  async generate(request: AIGenerateRequest): Promise<AIResult> {
    const started = Date.now();
    const effort = request.effort ?? "medium";
    try {
      const response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: request.maxTokens ?? 4096,
        system: request.system,
        messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
        thinking: { type: "adaptive" },
        output_config: {
          effort,
          ...(request.jsonSchema ? { format: zodOutputFormat(request.jsonSchema.schema) } : {}),
        },
        ...(this.fallbacks === "default" ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
      });
      const text = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
      const result: AIResult = {
        text,
        usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
        model: response.model,
        provider: this.key,
        durationMs: Date.now() - started,
        stopReason: response.stop_reason,
        refusal: null,
      };
      if (response.stop_reason === "refusal") {
        result.refusal = { category: response.stop_details?.category ?? null, explanation: response.stop_details?.explanation ?? null };
        log.warn("model declined request", { purpose: request.purpose, category: result.refusal.category });
        return result;
      }
      if (request.jsonSchema) {
        const parsed = request.jsonSchema.schema.safeParse(safeJsonParse(text));
        if (!parsed.success) {
          throw new ProviderError("anthropic", "Model returned output that did not match the expected schema", { errorClass: "TEMPORARY", details: parsed.error.issues.slice(0, 5) });
        }
        result.json = parsed.data;
      }
      return result;
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw mapAnthropicError(err);
    }
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function mapAnthropicError(err: unknown): ProviderError {
  if (err instanceof Anthropic.AuthenticationError) return new ProviderError("anthropic", "Anthropic rejected the API key", { errorClass: "AUTHENTICATION", cause: err });
  if (err instanceof Anthropic.RateLimitError) return new ProviderError("anthropic", "Anthropic rate limit reached, try again shortly", { errorClass: "RATE_LIMIT", cause: err });
  if (err instanceof Anthropic.BadRequestError) return new ProviderError("anthropic", `Anthropic rejected the request: ${err.message}`, { errorClass: "PERMANENT", cause: err });
  if (err instanceof Anthropic.APIConnectionError) return new ProviderError("anthropic", "Could not reach Anthropic", { errorClass: "TEMPORARY", cause: err });
  if (err instanceof Anthropic.APIError) return new ProviderError("anthropic", `Anthropic API error ${err.status}: ${err.message}`, { errorClass: (err.status ?? 500) >= 500 ? "TEMPORARY" : "PERMANENT", cause: err });
  return new ProviderError("anthropic", (err as Error).message ?? "Unknown AI provider error", { errorClass: "TEMPORARY", cause: err });
}
