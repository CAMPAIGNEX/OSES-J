import { createLogger, fetchWithTimeout, ProviderError } from "@oses/shared";
import { z } from "zod";
import type { AIGenerateRequest, AIProvider, AIResult, EmbeddingProvider } from "../types";

const log = createLogger("ai.openai");

export interface OpenAICompatibleOptions {
  apiKey: string;
  model: string;
  /** e.g. https://api.openai.com/v1 or https://openrouter.ai/api/v1 */
  baseUrl?: string;
  key?: string;
  timeoutMs?: number;
  /** Some gateways do not support json_schema response formats; fall back to json_object + instruction. */
  supportsJsonSchema?: boolean;
}

interface ChatCompletionResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

/**
 * OpenAI Chat Completions-compatible provider (OpenAI, OpenRouter, Groq, local gateways).
 * Uses raw HTTP so the platform stays dependency-light; only the small subset OSES-J needs.
 */
export class OpenAICompatibleProvider implements AIProvider {
  readonly key: string;
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly supportsJsonSchema: boolean;

  constructor(options: OpenAICompatibleOptions) {
    if (!options.apiKey) throw new ProviderError(options.key ?? "openai", "AI API key is not configured", { code: "AI_NOT_CONFIGURED", status: 503, errorClass: "USER_ACTION_REQUIRED" });
    if (!options.model) throw new ProviderError(options.key ?? "openai", "AI model is not configured", { code: "AI_NOT_CONFIGURED", status: 503, errorClass: "USER_ACTION_REQUIRED" });
    this.key = options.key ?? "openai";
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.supportsJsonSchema = options.supportsJsonSchema ?? true;
  }

  async generate(request: AIGenerateRequest): Promise<AIResult> {
    const started = Date.now();
    const body: Record<string, unknown> = {
      model: this.model,
      messages: [{ role: "system", content: request.system }, ...request.messages.map((m) => ({ role: m.role, content: m.content }))],
      max_tokens: request.maxTokens ?? 4096,
    };
    if (request.temperature != null) body.temperature = request.temperature;
    if (request.jsonSchema) {
      if (this.supportsJsonSchema) {
        body.response_format = { type: "json_schema", json_schema: { name: request.jsonSchema.name, schema: z.toJSONSchema(request.jsonSchema.schema), strict: false } };
      } else {
        body.response_format = { type: "json_object" };
      }
    }
    let res: Response;
    try {
      res = await fetchWithTimeout(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        timeoutMs: this.timeoutMs,
      });
    } catch (err) {
      throw new ProviderError(this.key, `Could not reach AI provider: ${(err as Error).message}`, { errorClass: "TEMPORARY", cause: err });
    }
    const json = (await res.json().catch(() => ({}))) as ChatCompletionResponse;
    if (!res.ok) {
      const message = json.error?.message ?? `HTTP ${res.status}`;
      const errorClass = res.status === 401 || res.status === 403 ? "AUTHENTICATION" : res.status === 429 ? "RATE_LIMIT" : res.status >= 500 ? "TEMPORARY" : "PERMANENT";
      throw new ProviderError(this.key, `AI provider error: ${message}`, { errorClass });
    }
    const choice = json.choices?.[0];
    const text = (choice?.message?.content ?? "").trim();
    const result: AIResult = {
      text,
      usage: { inputTokens: json.usage?.prompt_tokens ?? 0, outputTokens: json.usage?.completion_tokens ?? 0 },
      model: json.model ?? this.model,
      provider: this.key,
      durationMs: Date.now() - started,
      stopReason: choice?.finish_reason ?? null,
      refusal: choice?.message?.refusal ? { category: null, explanation: choice.message.refusal } : null,
    };
    if (request.jsonSchema && !result.refusal) {
      let parsedRaw: unknown = null;
      try {
        parsedRaw = JSON.parse(text);
      } catch {
        const s = text.indexOf("{");
        const e = text.lastIndexOf("}");
        if (s >= 0 && e > s) {
          try {
            parsedRaw = JSON.parse(text.slice(s, e + 1));
          } catch {
            parsedRaw = null;
          }
        }
      }
      const parsed = request.jsonSchema.schema.safeParse(parsedRaw);
      if (!parsed.success) {
        log.warn("schema mismatch from provider", { purpose: request.purpose, issues: parsed.error.issues.slice(0, 3) });
        throw new ProviderError(this.key, "Model returned output that did not match the expected schema", { errorClass: "TEMPORARY", details: parsed.error.issues.slice(0, 5) });
      }
      result.json = parsed.data;
    }
    return result;
  }
}

/** OpenAI-compatible embeddings endpoint (used for knowledge retrieval when configured). */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly key = "openai";
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: { apiKey: string; model?: string; baseUrl?: string }) {
    if (!options.apiKey) throw new ProviderError("openai", "Embedding API key is not configured", { code: "AI_NOT_CONFIGURED", status: 503, errorClass: "USER_ACTION_REQUIRED" });
    this.apiKey = options.apiKey;
    this.model = options.model ?? "text-embedding-3-small";
    this.baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];
    const res = await fetchWithTimeout(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, input: texts }),
      timeoutMs: 60_000,
    });
    const json = (await res.json().catch(() => ({}))) as { data?: Array<{ index: number; embedding: number[] }>; error?: { message?: string } };
    if (!res.ok) throw new ProviderError("openai", `Embedding error: ${json.error?.message ?? res.status}`, { errorClass: res.status >= 500 ? "TEMPORARY" : "PERMANENT" });
    return (json.data ?? []).sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
}
