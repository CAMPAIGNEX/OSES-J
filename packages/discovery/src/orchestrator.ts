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
      warnings.push("No discovery provider is active for the requested platform. The CNEX AI team activates it from the OS-Panel (Providers & keys).");
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
    if (leads.length > 0 && filtered.length < leads.length) warnings.push(describeExclusions(leads, criteria));
    const scored = filtered.map((lead) => ({ ...lead, score: scoreLead(lead, criteria) })).sort((a, b) => b.score.total - a.score.total);
    log.info("discovery finished", { raw, normalized: normalized.length, deduped: leads.length, merged, returned: scored.length });
    return { leads: scored, runs, warnings, totals: { raw, normalized: normalized.length, deduped: leads.length } };
  }
}

/** Why a lead fails the hard filters (first reason wins), or null when it passes. Unknown values are kept. */
export function exclusionReason(lead: NormalizedLead, criteria: SearchCriteria): string | null {
  if (criteria.minFollowers != null && lead.followers != null && lead.followers < criteria.minFollowers) return "fewer followers than your minimum";
  if (criteria.maxFollowers != null && lead.followers != null && lead.followers > criteria.maxFollowers) return "more followers than your maximum";
  if (criteria.filters.hasWebsite && !lead.website) return "no website";
  if (criteria.filters.hasEmail && !lead.email) return "no email";
  if (criteria.filters.hasPhone && !lead.phone) return "no phone";
  if (criteria.filters.hasWhatsApp && !lead.whatsapp) return "no WhatsApp";
  if (criteria.filters.businessOnly && lead.isBusiness === false) return "not a business account";
  if (criteria.filters.activeRecently && lead.lastPostAt && Date.now() - lead.lastPostAt.getTime() > 90 * 86_400_000) return "not active in the last 90 days";
  return null;
}

/** Apply hard filters that need provider data (follower range, contact availability). Unknown values are kept. */
export function applyCriteriaFilters(leads: NormalizedLead[], criteria: SearchCriteria): NormalizedLead[] {
  return leads.filter((lead) => exclusionReason(lead, criteria) === null);
}

/** Human explanation of what the filters removed, so an empty result never looks like a broken search. */
export function describeExclusions(leads: NormalizedLead[], criteria: SearchCriteria): string {
  const counts = new Map<string, number>();
  for (const lead of leads) {
    const reason = exclusionReason(lead, criteria);
    if (reason) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  const excluded = [...counts.values()].reduce((a, b) => a + b, 0);
  const parts = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([reason, n]) => `${n} ${reason}`);
  const range = criteria.minFollowers != null || criteria.maxFollowers != null ? ` (follower range ${criteria.minFollowers?.toLocaleString() ?? "0"}–${criteria.maxFollowers?.toLocaleString() ?? "∞"})` : "";
  return `${excluded} of ${leads.length} accounts found were excluded by your filters: ${parts.join(", ")}${range}. Widen the range or remove a filter to keep more of them.`;
}
