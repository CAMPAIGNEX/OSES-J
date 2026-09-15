import { ApifyClient } from "@oses/apify";
import { getPlatformConfig, type DbClient } from "@oses/database";
import { createLogger, decryptSecret, getEnv, type Platform } from "@oses/shared";
import { BUILT_IN_ADAPTERS, resolveAdapter, type ActorAdapter, type AdapterSettings } from "./apify/adapters";
import { ApifyContentProvider, ApifyDiscoveryProvider, ApifyProfileProvider } from "./apify/providers";
import { GoogleCseDiscoveryProvider } from "./google/cse";
import type { ContentProvider, DiscoveryProvider, ProfileProvider, SearchCriteria } from "./types";

const log = createLogger("discovery.registry");

export interface ProviderDefinition {
  domain: "DISCOVERY" | "ENRICHMENT" | "CONTENT";
  platform: Platform;
  actorId: string;
  adapter: string;
  priority: number;
  timeoutSec: number;
  costLimitUsd: number | null;
  settings: AdapterSettings;
  origin: "organization" | "global" | "environment";
}

export interface ResolvedProviders {
  discovery: DiscoveryProvider[];
  profile: ProfileProvider[];
  content: ContentProvider[];
  definitions: ProviderDefinition[];
  apifyConfigured: boolean;
  /** Google Programmable Search is configured (search-engine strategy works without Apify). */
  googleConfigured: boolean;
  warnings: string[];
}

export type ApifyTokenOrigin = "organization" | "platform" | "environment";

/**
 * Apify token for a workspace: its own token (encrypted in settings) wins, otherwise the platform token
 * set by operators in the OS-Panel (which itself falls back to APIFY_API_TOKEN). Discovery can be switched
 * off per workspace or for the whole platform.
 */
export async function resolveApifyToken(db: DbClient, organizationId: string): Promise<{ token: string | null; origin: ApifyTokenOrigin | null }> {
  const env = getEnv();
  const settings = await db.organizationSettings.findUnique({ where: { organizationId }, select: { apifyTokenEncrypted: true, apifyEnabled: true } });
  if (settings && settings.apifyEnabled === false) return { token: null, origin: null };
  if (settings?.apifyTokenEncrypted) {
    try {
      return { token: decryptSecret(settings.apifyTokenEncrypted, env.ENCRYPTION_KEY), origin: "organization" };
    } catch (err) {
      log.warn("could not decrypt organization Apify token", { organizationId, error: (err as Error).message });
    }
  }
  const platform = await getPlatformConfig(db);
  if (platform.apify.token && platform.apify.enabled) return { token: platform.apify.token, origin: platform.apify.origin };
  return { token: null, origin: null };
}

function strategyForAdapter(adapterKey: string): SearchCriteria["strategy"] {
  if (adapterKey.startsWith("search-engine")) return "search_engine";
  if (adapterKey === "instagram-hashtag") return "hashtag";
  return "profile_search";
}

/** Environment-derived defaults used when an organization has no ProviderConfig rows for a slot. */
export function environmentDefinitions(): ProviderDefinition[] {
  const env = getEnv();
  const timeoutSec = env.APIFY_RUN_TIMEOUT_SEC;
  const costLimitUsd = env.APIFY_MAX_COST_USD ? Number(env.APIFY_MAX_COST_USD) || null : null;
  const base = { timeoutSec, costLimitUsd, settings: {}, origin: "environment" as const };
  const defs: ProviderDefinition[] = [];
  if (env.APIFY_SEARCH_ENGINE_ACTOR) {
    defs.push({ domain: "DISCOVERY", platform: "INSTAGRAM", actorId: env.APIFY_SEARCH_ENGINE_ACTOR, adapter: "search-engine-instagram", priority: 1, ...base });
    defs.push({ domain: "DISCOVERY", platform: "FACEBOOK", actorId: env.APIFY_SEARCH_ENGINE_ACTOR, adapter: "search-engine-facebook", priority: 1, ...base });
  }
  if (env.APIFY_INSTAGRAM_DISCOVERY_ACTOR) {
    defs.push({ domain: "DISCOVERY", platform: "INSTAGRAM", actorId: env.APIFY_INSTAGRAM_DISCOVERY_ACTOR, adapter: "instagram-search", priority: 2, ...base });
  }
  if (env.APIFY_INSTAGRAM_HASHTAG_ACTOR) {
    defs.push({ domain: "DISCOVERY", platform: "INSTAGRAM", actorId: env.APIFY_INSTAGRAM_HASHTAG_ACTOR, adapter: "instagram-hashtag", priority: 3, ...base });
    defs.push({ domain: "CONTENT", platform: "INSTAGRAM", actorId: env.APIFY_INSTAGRAM_HASHTAG_ACTOR, adapter: "instagram-hashtag", priority: 1, ...base });
  }
  if (env.APIFY_FACEBOOK_DISCOVERY_ACTOR) {
    defs.push({ domain: "DISCOVERY", platform: "FACEBOOK", actorId: env.APIFY_FACEBOOK_DISCOVERY_ACTOR, adapter: "facebook-search", priority: 2, ...base });
  }
  if (env.APIFY_INSTAGRAM_PROFILE_ACTOR) {
    defs.push({ domain: "ENRICHMENT", platform: "INSTAGRAM", actorId: env.APIFY_INSTAGRAM_PROFILE_ACTOR, adapter: "instagram-profile", priority: 1, ...base });
  }
  if (env.APIFY_FACEBOOK_PAGES_ACTOR) {
    defs.push({ domain: "ENRICHMENT", platform: "FACEBOOK", actorId: env.APIFY_FACEBOOK_PAGES_ACTOR, adapter: "facebook-pages", priority: 1, ...base });
  }
  return defs;
}

/** Load provider definitions: organization rows override global rows, which override env defaults, per (domain, platform). */
export async function loadProviderDefinitions(db: DbClient, organizationId: string): Promise<ProviderDefinition[]> {
  const rows = await db.providerConfig.findMany({
    where: { enabled: true, provider: "apify", OR: [{ organizationId }, { organizationId: null }] },
    orderBy: [{ priority: "asc" }],
  });
  const fromDb: ProviderDefinition[] = rows
    .filter((r) => r.domain !== "MESSAGING")
    .map((r) => ({
      domain: r.domain as ProviderDefinition["domain"],
      platform: (r.platform === "FACEBOOK" ? "FACEBOOK" : "INSTAGRAM") as Platform,
      actorId: r.actorId,
      adapter: r.adapter,
      priority: r.priority,
      timeoutSec: r.timeoutSec,
      costLimitUsd: r.costLimitUsd ? Number(r.costLimitUsd) : null,
      settings: (r.settings as AdapterSettings | null) ?? {},
      origin: r.organizationId ? "organization" : "global",
    }));
  const slots = new Map<string, ProviderDefinition[]>();
  const slotKey = (d: ProviderDefinition) => `${d.domain}:${d.platform}`;
  for (const origin of ["organization", "global"] as const) {
    for (const d of fromDb.filter((x) => x.origin === origin)) {
      const key = slotKey(d);
      const existing = slots.get(key);
      if (existing && existing[0]?.origin !== origin) continue; // a more specific origin already filled this slot
      slots.set(key, [...(existing ?? []), d]);
    }
  }
  for (const d of environmentDefinitions()) {
    const key = slotKey(d);
    if (!slots.has(key)) slots.set(key, []);
    const list = slots.get(key)!;
    if (list.length === 0 || list[0]?.origin === "environment") list.push(d);
  }
  return [...slots.values()].flat();
}

export async function resolveProviders(db: DbClient, organizationId: string): Promise<ResolvedProviders> {
  const warnings: string[] = [];
  const definitions = await loadProviderDefinitions(db, organizationId);
  const [{ token }, platform] = await Promise.all([resolveApifyToken(db, organizationId), getPlatformConfig(db)]);
  const discovery: DiscoveryProvider[] = [];
  const profile: ProfileProvider[] = [];
  const content: ContentProvider[] = [];
  // Google's official API takes over the search-engine strategy when configured: cheaper, deterministic, no Actor.
  const googleConfigured = Boolean(platform.google.apiKey && platform.google.cseId);
  if (googleConfigured) {
    for (const p of ["INSTAGRAM", "FACEBOOK"] as const) discovery.push(new GoogleCseDiscoveryProvider({ apiKey: platform.google.apiKey!, cseId: platform.google.cseId! }, p));
  }
  if (!token) {
    if (!googleConfigured) warnings.push("Lead discovery is not active for this workspace. The CNEX AI team activates it from the OS-Panel (Providers & keys).");
    return { discovery, profile, content, definitions, apifyConfigured: false, googleConfigured, warnings };
  }
  const client = new ApifyClient({ token });
  for (const def of definitions) {
    // With Google configured, the paid search-engine Actor is redundant for the same slot.
    if (googleConfigured && def.domain === "DISCOVERY" && def.adapter.startsWith("search-engine")) continue;
    let adapter: ActorAdapter;
    try {
      adapter = resolveAdapter(def.adapter, def.platform, def.actorId);
    } catch (err) {
      warnings.push((err as Error).message);
      continue;
    }
    const cfg = { client, actorId: def.actorId, adapter, settings: def.settings, timeoutSec: def.timeoutSec, costLimitUsd: def.costLimitUsd, priority: def.priority };
    if (def.domain === "DISCOVERY" && adapter.purposes.includes("DISCOVERY")) discovery.push(new ApifyDiscoveryProvider(cfg, strategyForAdapter(def.adapter)));
    else if (def.domain === "ENRICHMENT" && adapter.purposes.includes("PROFILE")) profile.push(new ApifyProfileProvider(cfg));
    else if (def.domain === "CONTENT" && adapter.purposes.includes("CONTENT")) content.push(new ApifyContentProvider(cfg));
    else warnings.push(`Adapter "${def.adapter}" does not support ${def.domain.toLowerCase()} for ${def.actorId}`);
  }
  return { discovery, profile, content, definitions, apifyConfigured: true, googleConfigured, warnings };
}

/**
 * Recommended platform-wide Actor set, mirroring `environmentDefinitions()` but built from the adapter
 * catalogue's default Actor ids. The OS-Panel seeds platform ProviderConfig rows from this list so
 * discovery works with nothing but an Apify token.
 */
export function recommendedProviderRows(): Array<{ domain: "DISCOVERY" | "ENRICHMENT" | "CONTENT"; platform: Platform; adapter: string; actorId: string; priority: number }> {
  const a = BUILT_IN_ADAPTERS;
  const rows: Array<{ domain: "DISCOVERY" | "ENRICHMENT" | "CONTENT"; platform: Platform; adapter: string; actorId: string; priority: number }> = [
    { domain: "DISCOVERY", platform: "INSTAGRAM", adapter: "search-engine-instagram", actorId: a["search-engine-instagram"]!.defaultActorId, priority: 1 },
    { domain: "DISCOVERY", platform: "FACEBOOK", adapter: "search-engine-facebook", actorId: a["search-engine-facebook"]!.defaultActorId, priority: 1 },
    { domain: "DISCOVERY", platform: "INSTAGRAM", adapter: "instagram-search", actorId: a["instagram-search"]!.defaultActorId, priority: 2 },
    { domain: "DISCOVERY", platform: "FACEBOOK", adapter: "facebook-search", actorId: a["facebook-search"]!.defaultActorId, priority: 2 },
    { domain: "DISCOVERY", platform: "INSTAGRAM", adapter: "instagram-hashtag", actorId: a["instagram-hashtag"]!.defaultActorId, priority: 3 },
    { domain: "CONTENT", platform: "INSTAGRAM", adapter: "instagram-hashtag", actorId: a["instagram-hashtag"]!.defaultActorId, priority: 1 },
    { domain: "ENRICHMENT", platform: "INSTAGRAM", adapter: "instagram-profile", actorId: a["instagram-profile"]!.defaultActorId, priority: 1 },
    { domain: "ENRICHMENT", platform: "FACEBOOK", adapter: "facebook-pages", actorId: a["facebook-pages"]!.defaultActorId, priority: 1 },
  ];
  return rows;
}
