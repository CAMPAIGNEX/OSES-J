/**
 * Catalogue of AI providers OSES-J can talk to. Anthropic has its own API; every other entry speaks the
 * OpenAI chat-completions dialect at a preset base URL, which is what lets hosted, open-source and
 * self-hosted models all plug into the same `OpenAICompatibleProvider`.
 */
export type AIProviderApi = "anthropic" | "openai";

export interface AIProviderPreset {
  key: string;
  label: string;
  group: "hosted" | "open" | "local" | "custom";
  api: AIProviderApi;
  /** Default endpoint; null means the operator must enter one. */
  baseUrl: string | null;
  defaultModel: string;
  /** Whether the endpoint accepts `response_format: json_schema` (otherwise json_object + prompt). */
  supportsJsonSchema: boolean;
  /** Local / self-hosted servers usually run without a key. */
  keyOptional?: boolean;
  /** Where to get a key or what to know. */
  hint: string;
}

export const AI_PROVIDER_PRESETS: readonly AIProviderPreset[] = [
  { key: "anthropic", label: "Anthropic Claude", group: "hosted", api: "anthropic", baseUrl: null, defaultModel: "claude-opus-5", supportsJsonSchema: true, hint: "console.anthropic.com → API keys" },
  { key: "openai", label: "OpenAI (ChatGPT)", group: "hosted", api: "openai", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-5", supportsJsonSchema: true, hint: "platform.openai.com → API keys" },
  { key: "google", label: "Google Gemini", group: "hosted", api: "openai", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", defaultModel: "gemini-2.5-pro", supportsJsonSchema: false, hint: "aistudio.google.com → Get API key" },
  { key: "xai", label: "xAI Grok", group: "hosted", api: "openai", baseUrl: "https://api.x.ai/v1", defaultModel: "grok-4", supportsJsonSchema: true, hint: "console.x.ai → API keys" },
  { key: "deepseek", label: "DeepSeek", group: "hosted", api: "openai", baseUrl: "https://api.deepseek.com/v1", defaultModel: "deepseek-chat", supportsJsonSchema: false, hint: "platform.deepseek.com → API keys" },
  { key: "qwen", label: "Alibaba Qwen", group: "hosted", api: "openai", baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", defaultModel: "qwen-plus", supportsJsonSchema: false, hint: "Alibaba Cloud Model Studio (DashScope) → API keys" },
  { key: "mistral", label: "Mistral", group: "hosted", api: "openai", baseUrl: "https://api.mistral.ai/v1", defaultModel: "mistral-large-latest", supportsJsonSchema: false, hint: "console.mistral.ai → API keys" },
  { key: "nvidia", label: "NVIDIA NIM", group: "hosted", api: "openai", baseUrl: "https://integrate.api.nvidia.com/v1", defaultModel: "meta/llama-3.3-70b-instruct", supportsJsonSchema: false, hint: "build.nvidia.com → Get API key" },
  { key: "groq", label: "Groq (open models, very fast)", group: "open", api: "openai", baseUrl: "https://api.groq.com/openai/v1", defaultModel: "llama-3.3-70b-versatile", supportsJsonSchema: false, hint: "console.groq.com → API keys" },
  { key: "together", label: "Together AI (open models)", group: "open", api: "openai", baseUrl: "https://api.together.xyz/v1", defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo", supportsJsonSchema: false, hint: "api.together.ai → API keys" },
  { key: "openrouter", label: "OpenRouter (any model, one key)", group: "open", api: "openai", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "openai/gpt-5", supportsJsonSchema: false, hint: "openrouter.ai → Keys; model ids look like vendor/model" },
  { key: "ollama", label: "Ollama (self-hosted / local)", group: "local", api: "openai", baseUrl: "http://localhost:11434/v1", defaultModel: "llama3.1", supportsJsonSchema: false, keyOptional: true, hint: "The OSES-J server must reach this URL; on shared hosting use a public address or tunnel, not localhost" },
  { key: "lmstudio", label: "LM Studio (local)", group: "local", api: "openai", baseUrl: "http://localhost:1234/v1", defaultModel: "", supportsJsonSchema: false, keyOptional: true, hint: "Start the LM Studio server; model id as shown in LM Studio" },
  { key: "openai_compatible", label: "Custom OpenAI-compatible endpoint", group: "custom", api: "openai", baseUrl: null, defaultModel: "", supportsJsonSchema: false, keyOptional: true, hint: "Any server exposing /chat/completions (vLLM, LiteLLM, Azure OpenAI, ...)" },
] as const;

export const AI_PROVIDER_KEYS = AI_PROVIDER_PRESETS.map((p) => p.key) as [string, ...string[]];

export type AIProviderKey = (typeof AI_PROVIDER_PRESETS)[number]["key"];

export function aiProviderPreset(key: string | null | undefined): AIProviderPreset | null {
  return AI_PROVIDER_PRESETS.find((p) => p.key === key) ?? null;
}

/** True when the provider can run without an API key (local / self-hosted servers). */
export function aiProviderKeyOptional(key: string | null | undefined): boolean {
  return aiProviderPreset(key)?.keyOptional === true;
}

/** Whether provider + key (or key-less local provider) is enough to create a client. */
export function aiProviderConfigured(provider: string | null | undefined, apiKey: string | null | undefined): boolean {
  if (!provider || provider === "none") return false;
  return Boolean(apiKey) || aiProviderKeyOptional(provider);
}
