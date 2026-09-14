import { createLogger } from "@oses/shared";
import { dedupeBatch } from "./dedupe";
import { normalizeDiscoveryResult, type NormalizedLead } from "./normalizer";
import { scoreLead, type ScoreBreakdown } from "./scoring";
import type { DiscoveryContext, DiscoveryProvider, ProviderRunMeta, SearchCriteria } from "./types";

const log = createLogger("discovery.orchestrator");

export type ScoredLead = NormalizedLead & { score: ScoreBreakdown };

export interface OrchestratorOutput {
  leads: ScoredLead[];
  runs: ProviderRunMeta[];
  warnings: string[];
  totals: { raw: number; normalized: number; deduped: number };
}

/**
 * Runs the applicable providers for the criteria, then normalizes, deduplicates and scores results.
 *
 *   Query -> Criteria -> Providers -> Raw -> Normalize -> Dedupe -> Score -> Results
 *
 * Providers are tried in priority order per platform. In "auto" strategy the search-engine
 * strategy runs first when a location is present (it captures bios mentioning the city), and
 * profile/hashtag search fills the remaining quota.
 */
export class DiscoveryOrchestrator {
  constructor(private readonly providers: DiscoveryProvider[]) {}

  selectProviders(criteria: SearchCriteria): DiscoveryProvider[] {
    const applicable = this.providers.filter((p) => p.supports(criteria));
    const hasLocation = Boolean(criteria.location.city || criteria.location.country);
    const rank = (p: DiscoveryProvider): number => {
      const strategyRank =
        criteria.strategy !== "auto" ? 0 : p.strategy === "search_engine" ? (hasLocation ? 0 : 1) : p.strategy === "profile_search" ? (hasLocation ? 1 : 0) : 2;
      return strategyRank * 100 + p.priority;
    };
    return applicable.sort((a, b) => rank(a) - rank(b));
  }

  async run(criteria: SearchCriteria, ctx: DiscoveryContext): Promise<OrchestratorOutput> {
    const providers = this.selectProviders(criteria);
    const warnings: string[] = [];
    const runs: ProviderRunMeta[] = [];
    const normalized: NormalizedLead[] = [];
    let raw = 0;
    if (!providers.length) {
      warnings.push("No discovery provider is configured for the requested platform. Configure an Apify Actor in Settings > Providers.");
    }
    const perPlatformCount = new Map<string, number>();
    for (const provider of providers) {
      const have = perPlatformCount.get(provider.platform) ?? 0;
      if (have >= criteria.limit) continue;
      await ctx.onProgress?.("provider", { provider: provider.key, strategy: provider.strategy });
      const batch = await provider.search(criteria, ctx);
      runs.push(...batch.runs);
      warnings.push(...batch.warnings);
      raw += batch.results.length;
      for (const r of batch.results) {
        try {
          normalized.push(normalizeDiscoveryResult(r));
        } catch (err) {
          log.warn("failed to normalize result", { provider: provider.key, error: (err as Error).message });
        }
      }
      perPlatformCount.set(provider.platform, have + batch.results.length);
    }
    const { leads, merged } = dedupeBatch(normalized);
    const filtered = applyCriteriaFilters(leads, criteria);
    const scored = filtered.map((lead) => ({ ...lead, score: scoreLead(lead, criteria) })).sort((a, b) => b.score.total - a.score.total);
    log.info("discovery finished", { raw, normalized: normalized.length, deduped: leads.length, merged, returned: scored.length });
    return { leads: scored, runs, warnings, totals: { raw, normalized: normalized.length, deduped: leads.length } };
  }
}

/** Apply hard filters that need provider data (follower range, contact availability). Unknown values are kept. */
export function applyCriteriaFilters(leads: NormalizedLead[], criteria: SearchCriteria): NormalizedLead[] {
  return leads.filter((lead) => {
    if (criteria.minFollowers != null && lead.followers != null && lead.followers < criteria.minFollowers) return false;
    if (criteria.maxFollowers != null && lead.followers != null && lead.followers > criteria.maxFollowers) return false;
    if (criteria.filters.hasWebsite && !lead.website) return false;
    if (criteria.filters.hasEmail && !lead.email) return false;
    if (criteria.filters.hasPhone && !lead.phone) return false;
    if (criteria.filters.hasWhatsApp && !lead.whatsapp) return false;
    if (criteria.filters.businessOnly && lead.isBusiness === false) return false;
    if (criteria.filters.activeRecently && lead.lastPostAt && Date.now() - lead.lastPostAt.getTime() > 90 * 86_400_000) return false;
    return true;
  });
}
