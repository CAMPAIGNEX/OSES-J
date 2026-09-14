import type { z } from "zod";

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

export interface AIProviderSettings {
  provider: "anthropic" | "openai" | "openai_compatible" | "none";
  apiKey?: string | null;
  model?: string | null;
  baseUrl?: string | null;
  temperature?: number | null;
}

export const DEFAULT_MODELS: Record<Exclude<AIProviderSettings["provider"], "none">, string> = {
  anthropic: "claude-opus-5",
  openai: "gpt-4.1",
  openai_compatible: "",
};
