import type { z } from "zod";
import { AI_PROVIDER_PRESETS } from "@oses/shared";

/**
 * Provider-agnostic AI contracts. Business logic (sales agent, knowledge base) only depends on these.
 */

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

export type AIEffort = "low" | "medium" | "high";

export interface AIGenerateRequest {
  system: string;
  messages: AIMessage[];
  /** Upper bound on output tokens. */
  maxTokens?: number;
  /** Sampling temperature; ignored by providers/models that do not support it. */
  temperature?: number;
  /** Reasoning effort hint for models that support it. */
  effort?: AIEffort;
  /** When set, the provider constrains output to this schema and returns `json`. */
  jsonSchema?: { name: string; schema: z.ZodType };
  /** Free-form tag for logging. */
  purpose?: string;
}

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AIResult {
  text: string;
  json?: unknown;
  usage: AIUsage;
  model: string;
  provider: string;
  durationMs: number;
  stopReason?: string | null;
  /** Populated when the provider declined the request for policy reasons. */
  refusal?: { category: string | null; explanation: string | null } | null;
}

export interface AIProvider {
  readonly key: string;
  readonly model: string;
  generate(request: AIGenerateRequest): Promise<AIResult>;
}

export interface EmbeddingProvider {
  readonly key: string;
  readonly model: string;
  embed(texts: string[]): Promise<number[][]>;
}

/** `provider` is a key from the shared AI_PROVIDER_PRESETS catalogue ("anthropic", "openai", "google", "xai", ..., "ollama") or "none". */
export interface AIProviderSettings {
  provider: string;
  apiKey?: string | null;
  model?: string | null;
  baseUrl?: string | null;
  temperature?: number | null;
}

/** Default model per provider key, taken from the shared catalogue. */
export const DEFAULT_MODELS: Record<string, string> = Object.fromEntries(AI_PROVIDER_PRESETS.map((p) => [p.key, p.defaultModel]));
