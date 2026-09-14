import { z } from "zod";

/**
 * Central environment configuration.
 *
 * Every process (web app, workers, tests) reads configuration through getEnv().
 * Values are validated once; misconfiguration fails fast with a readable message.
 * Secrets are never logged (see logger.ts redaction).
 */

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined));

const intWithDefault = (def: number) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "") return def;
      const n = typeof v === "number" ? v : Number.parseInt(v, 10);
      return Number.isFinite(n) ? n : def;
    });

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3100"),
  PORT: intWithDefault(3100),
  AUTH_SECRET: optionalString,
  NEXTAUTH_SECRET: optionalString,
  ENCRYPTION_KEY: optionalString,

  DATABASE_URL: optionalString,
  TEST_DATABASE_URL: optionalString,

  JOB_RUNNER_MODE: z.enum(["inline", "cron", "worker"]).default("inline"),
  INTERNAL_JOB_SECRET: optionalString,
  QUEUE_DRIVER: z.enum(["mysql", "redis"]).default("mysql"),
  REDIS_URL: optionalString,
  WORKER_CONCURRENCY: intWithDefault(2),
  WORKER_POLL_INTERVAL_MS: intWithDefault(3000),

  AI_PROVIDER: z.enum(["anthropic", "openai", "openai_compatible", "none"]).default("none"),
  AI_API_KEY: optionalString,
  AI_MODEL: optionalString,
  AI_BASE_URL: optionalString,
  AI_EMBEDDING_PROVIDER: z.enum(["openai", "none"]).default("none"),
  AI_EMBEDDING_MODEL: optionalString,
  AI_EMBEDDING_API_KEY: optionalString,

  APIFY_API_TOKEN: optionalString,
  APIFY_INSTAGRAM_DISCOVERY_ACTOR: optionalString,
  APIFY_INSTAGRAM_PROFILE_ACTOR: optionalString,
  APIFY_FACEBOOK_DISCOVERY_ACTOR: optionalString,
  APIFY_FACEBOOK_PAGES_ACTOR: optionalString,
  APIFY_INSTAGRAM_HASHTAG_ACTOR: optionalString,
  APIFY_SEARCH_ENGINE_ACTOR: optionalString,
  APIFY_MESSAGING_ACTOR: optionalString,
  APIFY_INSTAGRAM_MESSAGE_ACTOR: optionalString,
  APIFY_RUN_TIMEOUT_SEC: intWithDefault(600),
  APIFY_MAX_COST_USD: optionalString,

  META_APP_ID: optionalString,
  META_APP_SECRET: optionalString,
  META_WEBHOOK_VERIFY_TOKEN: optionalString,
  META_GRAPH_VERSION: z.string().default("v23.0"),

  STORAGE_DRIVER: z.enum(["local"]).default("local"),
  STORAGE_DIR: z.string().default("./storage"),

  EXTENSION_ACCESS_TOKEN_TTL_MINUTES: intWithDefault(60),
  EXTENSION_REFRESH_TOKEN_TTL_DAYS: intWithDefault(30),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "silent"]).default("info"),
  LOG_FORMAT: z.enum(["pretty", "json"]).default("pretty"),
  SENTRY_DSN: optionalString,

  TRASH_RETENTION_DAYS: intWithDefault(7),
  DEFAULT_TIMEZONE: z.string().default("Asia/Karachi"),
});

export type Env = z.infer<typeof envSchema> & {
  /** Resolved auth secret (AUTH_SECRET, falling back to NEXTAUTH_SECRET). */
  authSecret: string | undefined;
  isProduction: boolean;
  isTest: boolean;
};

let cached: Env | undefined;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join("\n")}`);
  }
  const data = parsed.data;
  const env: Env = {
    ...data,
    authSecret: data.AUTH_SECRET ?? data.NEXTAUTH_SECRET,
    isProduction: data.NODE_ENV === "production",
    isTest: data.NODE_ENV === "test",
  };
  // Required secrets are enforced at runtime only: `next build` runs with NODE_ENV=production on hosts
  // that inject environment variables at start time, and must not fail because they are absent.
  const isBuildPhase = typeof source.NEXT_PHASE === "string" && source.NEXT_PHASE.startsWith("phase-production-build");
  if (env.isProduction && !isBuildPhase) {
    const missing: string[] = [];
    if (!env.authSecret) missing.push("AUTH_SECRET");
    if (!env.ENCRYPTION_KEY) missing.push("ENCRYPTION_KEY");
    if (!env.DATABASE_URL) missing.push("DATABASE_URL");
    if (missing.length) throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }
  return env;
}

/** Non-throwing configuration report (names only, never values) for health checks and startup logs. */
export function checkEnv(source: NodeJS.ProcessEnv = process.env): { ok: boolean; missing: string[]; invalid: string[]; nodeEnv: string } {
  const parsed = envSchema.safeParse(source);
  const invalid = parsed.success ? [] : parsed.error.issues.map((i) => i.path.join("."));
  const missing: string[] = [];
  if (source.NODE_ENV === "production") {
    if (!source.AUTH_SECRET && !source.NEXTAUTH_SECRET) missing.push("AUTH_SECRET");
    if (!source.ENCRYPTION_KEY) missing.push("ENCRYPTION_KEY");
    if (!source.DATABASE_URL) missing.push("DATABASE_URL");
  }
  return { ok: invalid.length === 0 && missing.length === 0, missing, invalid, nodeEnv: source.NODE_ENV ?? "development" };
}

export function getEnv(): Env {
  if (!cached) cached = loadEnv();
  return cached;
}

/** Test helper: replace the cached env with overrides applied on top of process.env. */
export function setEnvForTests(overrides: Partial<NodeJS.ProcessEnv>): Env {
  cached = loadEnv({ ...process.env, ...overrides });
  return cached;
}

export function resetEnvCache(): void {
  cached = undefined;
}
