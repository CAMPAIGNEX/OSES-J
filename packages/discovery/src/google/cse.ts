import { createLogger, errorMessage, fetchWithTimeout, type Platform } from "@oses/shared";
import { buildSearchEngineQueries, normalizeSearchEngineItems } from "../apify/adapters";
import type { DiscoveryBatch, DiscoveryContext, DiscoveryProvider, DiscoveryResult, ProviderRunMeta, SearchCriteria } from "../types";

const log = createLogger("discovery.google");

export interface GoogleCseConfig {
  apiKey: string;
  cseId: string;
  /** Results per query (Google allows at most 10 per request). */
  perQuery?: number;
}

interface CseItem {
  link?: string;
  title?: string;
  snippet?: string;
  htmlSnippet?: string;
}

interface CseResponse {
  items?: CseItem[];
  searchInformation?: { totalResults?: string };
  error?: { code?: number; message?: string };
}

export const GOOGLE_CSE_ENDPOINT = "https://www.googleapis.com/customsearch/v1";

/** One Custom Search request. Exposed for the OS-Panel connection test. */
export async function googleCseSearch(cfg: GoogleCseConfig, query: string, options: { num?: number; signal?: AbortSignal } = {}): Promise<CseItem[]> {
  const url = new URL(GOOGLE_CSE_ENDPOINT);
  url.searchParams.set("key", cfg.apiKey);
  url.searchParams.set("cx", cfg.cseId);
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(Math.min(10, Math.max(1, options.num ?? cfg.perQuery ?? 10))));
  url.searchParams.set("safe", "off");
  const res = await fetchWithTimeout(url.toString(), { timeoutMs: 15_000, signal: options.signal });
  const json = (await res.json().catch(() => ({}))) as CseResponse;
  if (!res.ok || json.error) {
    const msg = json.error?.message ?? res.statusText;
    throw new Error(`Google Custom Search ${res.status}: ${msg}`);
  }
  return json.items ?? [];
}

/**
 * Search-engine strategy through Google's official Custom Search JSON API instead of a scraping Actor:
 * deterministic, 100 free queries a day, then $5 per 1,000. Runs the same site-restricted queries as the
 * Apify search-engine adapter and normalizes the results with the same code, so leads look identical.
 */
export class GoogleCseDiscoveryProvider implements DiscoveryProvider {
  readonly key: string;
  readonly strategy: SearchCriteria["strategy"] = "search_engine";
  readonly priority = 0;

  constructor(
    private readonly cfg: GoogleCseConfig,
    readonly platform: Platform,
  ) {
    this.key = `google:cse:${platform.toLowerCase()}`;
  }

  supports(criteria: SearchCriteria): boolean {
    if (!criteria.platforms.includes(this.platform)) return false;
    return criteria.strategy === "auto" || criteria.strategy === "search_engine";
  }

  async search(criteria: SearchCriteria, ctx: DiscoveryContext): Promise<DiscoveryBatch> {
    const queries = buildSearchEngineQueries(criteria, this.platform, 2);
    const startedAt = new Date();
    const warnings: string[] = [];
    const pages: Array<{ searchQuery: string; organicResults: Array<{ url: string; title: string; description: string; position: number }> }> = [];
    let error: string | null = null;
    for (const q of queries) {
      try {
        const items = await googleCseSearch(this.cfg, q, { signal: ctx.signal });
        pages.push({ searchQuery: q, organicResults: items.filter((i) => i.link).map((i, idx) => ({ url: i.link!, title: i.title ?? "", description: i.snippet ?? "", position: idx + 1 })) });
      } catch (err) {
        error = errorMessage(err);
        log.warn("Google Custom Search failed", { query: q, error });
        break;
      }
    }
    const itemCount = pages.reduce((n, p) => n + p.organicResults.length, 0);
    const meta: ProviderRunMeta = {
      provider: "google",
      actorId: "customsearch/v1",
      adapter: this.platform === "INSTAGRAM" ? "search-engine-instagram" : "search-engine-facebook",
      purpose: "DISCOVERY",
      status: error && pages.length === 0 ? "FAILED" : "SUCCEEDED",
      input: { queries },
      itemCount,
      costUsd: 0,
      error,
      startedAt,
      finishedAt: new Date(),
    };
    await ctx.onProviderRun?.(meta);
    if (error) warnings.push(`Google search: ${error}`);
    const source = { provider: "google", actorId: "customsearch/v1", adapter: meta.adapter, fetchedAt: meta.finishedAt };
    const results: DiscoveryResult[] = normalizeSearchEngineItems(pages, this.platform, source).filter((r) => r.platform === this.platform);
    if (itemCount > 0 && results.length === 0) warnings.push(`Google returned ${itemCount} results but none were usable ${this.platform === "INSTAGRAM" ? "Instagram" : "Facebook"} profiles. Try different keywords.`);
    log.info("Google Custom Search finished", { platform: this.platform, queries: queries.length, items: itemCount, results: results.length });
    return { results, runs: [meta], warnings };
  }
}
