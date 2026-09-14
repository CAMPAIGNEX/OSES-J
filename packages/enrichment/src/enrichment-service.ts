import type { DbClient, Lead } from "@oses/database";
import { recordUsage } from "@oses/database";
import { applyProfileToLead, normalizeDiscoveryResult, resolveProviders, scoreLead, type DiscoveryResult, type ProfileProvider } from "@oses/discovery";
import { createLogger, errorMessage, extractDomain, isLinkAggregatorDomain, normalizeUrl, resolveTimezone, type Platform } from "@oses/shared";
import { extractWebsite, type WebsiteExtraction } from "./website-extractor";

const log = createLogger("enrichment");

/**
 * Generic enrichment contract (spec: EnrichmentProvider.enrich(lead) -> EnrichmentResult).
 * Implementations must label the source of every field they add.
 */
export interface EnrichmentTarget {
  id: string;
  platform: Platform;
  username: string | null;
  profileUrl: string | null;
  externalId?: string | null;
  website: string | null;
}

export interface EnrichmentResult {
  providerKey: string;
  contacts: Array<{ type: "EMAIL" | "PHONE" | "WHATSAPP" | "ADDRESS" | "WEBSITE"; value: string; normalizedValue: string; source: "WEBSITE" | "PROFILE" | "FACEBOOK_PAGE"; sourceUrl: string | null; confidence: "VERIFIED" | "PUBLIC" | "INFERRED"; label?: string | null }>;
  fields: Partial<{ website: string; websiteDomain: string; siteName: string; description: string }>;
  socialLinks: Array<{ platform: Platform; username: string | null; profileUrl: string; externalId: string | null }>;
  profile?: DiscoveryResult | null;
  warnings: string[];
}

export interface EnrichmentProvider {
  readonly key: string;
  enrich(target: EnrichmentTarget): Promise<EnrichmentResult>;
}

/** Website extraction as an EnrichmentProvider. */
export class WebsiteEnrichmentProvider implements EnrichmentProvider {
  readonly key = "website";
  async enrich(target: EnrichmentTarget): Promise<EnrichmentResult> {
    const result: EnrichmentResult = { providerKey: this.key, contacts: [], fields: {}, socialLinks: [], warnings: [] };
    if (!target.website) {
      result.warnings.push("No website to extract");
      return result;
    }
    const extraction = await extractWebsite(target.website);
    return websiteExtractionToResult(extraction, result);
  }
}

export function websiteExtractionToResult(extraction: WebsiteExtraction, result: EnrichmentResult): EnrichmentResult {
  result.warnings.push(...extraction.warnings);
  for (const c of extraction.contacts) {
    result.contacts.push({ type: c.type, value: c.value, normalizedValue: c.normalizedValue, source: "WEBSITE", sourceUrl: c.sourceUrl, confidence: c.confidence, label: c.label ?? null });
  }
  result.socialLinks.push(...extraction.socialLinks);
  if (extraction.siteName) result.fields.siteName = extraction.siteName;
  if (extraction.description) result.fields.description = extraction.description;
  const domain = extraction.domain;
  if (domain && !isLinkAggregatorDomain(domain)) {
    result.fields.website = extraction.finalUrl;
    result.fields.websiteDomain = domain;
  }
  return result;
}

interface ProfileBatchOutcome {
  byKey: Map<string, DiscoveryResult>;
  warnings: string[];
}

async function fetchProfilesFor(providers: ProfileProvider[], organizationId: string, platform: Platform, targets: EnrichmentTarget[]): Promise<ProfileBatchOutcome> {
  const provider = providers.find((p) => p.platform === platform);
  const outcome: ProfileBatchOutcome = { byKey: new Map(), warnings: [] };
  if (!provider) {
    outcome.warnings.push(`No profile enrichment provider configured for ${platform}`);
    return outcome;
  }
  const batch = await provider.fetchProfiles(
    targets.filter((t) => t.profileUrl).map((t) => ({ username: t.username, profileUrl: t.profileUrl as string, externalId: t.externalId ?? null })),
    { organizationId },
  );
  outcome.warnings.push(...batch.warnings);
  for (const r of batch.results) {
    if (r.username) outcome.byKey.set(`u:${r.username}`, r);
    if (r.externalId) outcome.byKey.set(`id:${r.externalId}`, r);
  }
  return outcome;
}

function matchProfile(byKey: Map<string, DiscoveryResult>, target: EnrichmentTarget): DiscoveryResult | undefined {
  return (target.username ? byKey.get(`u:${target.username}`) : undefined) ?? (target.externalId ? byKey.get(`id:${target.externalId}`) : undefined);
}

let testProfileProviders: ProfileProvider[] | undefined;

/** Test hook: force the profile providers used by enrichLeads. */
export function setProfileProvidersForTests(providers: ProfileProvider[] | undefined): void {
  testProfileProviders = providers;
}

export interface EnrichLeadsOptions {
  profile?: boolean;
  website?: boolean;
  profileProviders?: ProfileProvider[];
  websiteProvider?: EnrichmentProvider;
}

export interface EnrichLeadsSummary {
  processed: number;
  profileEnriched: number;
  websiteEnriched: number;
  failed: number;
  warnings: string[];
}

/**
 * Enrich a set of leads: profile details through the platform provider (one Actor run per platform),
 * then website extraction for leads with a real website. Every added contact carries source + confidence.
 */
export async function enrichLeads(db: DbClient, organizationId: string, leadIds: string[], options: EnrichLeadsOptions = {}): Promise<EnrichLeadsSummary> {
  const summary: EnrichLeadsSummary = { processed: 0, profileEnriched: 0, websiteEnriched: 0, failed: 0, warnings: [] };
  const leads = await db.lead.findMany({ where: { id: { in: leadIds }, organizationId, deletedAt: null } });
  if (!leads.length) return summary;
  await db.lead.updateMany({ where: { id: { in: leads.map((l) => l.id) } }, data: { enrichmentStatus: "RUNNING" } });

  let profileProviders = options.profileProviders ?? testProfileProviders;
  if (options.profile !== false && !profileProviders) {
    const resolved = await resolveProviders(db, organizationId);
    profileProviders = resolved.profile;
    summary.warnings.push(...resolved.warnings);
  }
  const websiteProvider = options.websiteProvider ?? new WebsiteEnrichmentProvider();
  const targets: EnrichmentTarget[] = leads.map((l) => ({ id: l.id, platform: l.primaryPlatform ?? "INSTAGRAM", username: l.username, profileUrl: l.profileUrl, externalId: l.externalId, website: l.website }));

  // 1) profile enrichment per platform
  const profileByLead = new Map<string, DiscoveryResult>();
  if (options.profile !== false && profileProviders?.length) {
    for (const platform of ["INSTAGRAM", "FACEBOOK"] as Platform[]) {
      const group = targets.filter((t) => t.platform === platform && (t.username || t.externalId));
      if (!group.length) continue;
      try {
        const outcome = await fetchProfilesFor(profileProviders, organizationId, platform, group);
        summary.warnings.push(...outcome.warnings);
        for (const t of group) {
          const p = matchProfile(outcome.byKey, t);
          if (p) profileByLead.set(t.id, p);
        }
        await recordUsage(db, organizationId, "ENRICHMENT_REQUESTS", group.length);
      } catch (err) {
        summary.warnings.push(`Profile enrichment failed for ${platform}: ${errorMessage(err)}`);
      }
    }
  }

  // 2) apply per lead
  for (const lead of leads) {
    summary.processed++;
    try {
      const profile = profileByLead.get(lead.id);
      let current: Lead = lead;
      if (profile) {
        const normalized = normalizeDiscoveryResult(profile);
        const score = scoreLead(normalized);
        await applyProfileToLead(db, organizationId, lead.id, normalized, { total: score.total, breakdown: score });
        summary.profileEnriched++;
        current = (await db.lead.findUnique({ where: { id: lead.id } })) ?? lead;
      }
      if (options.website !== false && current.website) {
        const enriched = await websiteProvider.enrich({ id: current.id, platform: current.primaryPlatform ?? "INSTAGRAM", username: current.username, profileUrl: current.profileUrl, website: current.website });
        if (enriched.contacts.length || enriched.fields.websiteDomain) {
          await applyEnrichmentToLead(db, organizationId, current.id, enriched);
          summary.websiteEnriched++;
        }
        summary.warnings.push(...enriched.warnings.map((w) => `${current.brandName}: ${w}`));
      }
      const final = await db.lead.findUnique({ where: { id: lead.id } });
      if (final) {
        const tz = final.city || final.country ? resolveTimezone({ country: final.country, region: final.region, city: final.city }) : null;
        await db.lead.update({
          where: { id: lead.id },
          data: {
            enrichmentStatus: profile || final.email || final.phone ? "COMPLETED" : "PARTIAL",
            enrichedAt: new Date(),
            timezone: tz && tz.source !== "default" ? tz.timezone : final.timezone,
          },
        });
      }
    } catch (err) {
      summary.failed++;
      await db.lead.update({ where: { id: lead.id }, data: { enrichmentStatus: "FAILED", enrichmentError: errorMessage(err).slice(0, 2000) } }).catch(() => undefined);
      log.warn("lead enrichment failed", { leadId: lead.id, error: errorMessage(err) });
    }
  }
  return summary;
}

/** Persist website-derived contacts/fields on a lead (fill blanks, add labelled contacts). */
export async function applyEnrichmentToLead(db: DbClient, organizationId: string, leadId: string, result: EnrichmentResult): Promise<void> {
  const lead = await db.lead.findFirst({ where: { id: leadId, organizationId } });
  if (!lead) return;
  const data: Record<string, unknown> = {};
  const firstOf = (type: string, pref: "VERIFIED" | "PUBLIC" = "VERIFIED") =>
    result.contacts.find((c) => c.type === type && c.confidence === pref) ?? result.contacts.find((c) => c.type === type);
  const email = firstOf("EMAIL");
  const phone = firstOf("PHONE");
  const whatsapp = firstOf("WHATSAPP");
  const address = firstOf("ADDRESS");
  if (!lead.email && email) data.email = email.normalizedValue;
  if (!lead.phone && phone) data.phone = phone.normalizedValue;
  if (!lead.whatsapp && whatsapp) data.whatsapp = whatsapp.normalizedValue;
  if (!lead.address && address) data.address = address.value.slice(0, 300);
  if (result.fields.websiteDomain && (!lead.websiteDomain || isLinkAggregatorDomain(lead.websiteDomain))) {
    data.website = normalizeUrl(result.fields.website ?? lead.website) ?? lead.website;
    data.websiteDomain = result.fields.websiteDomain;
  }
  if (!lead.name && result.fields.siteName) data.name = result.fields.siteName.slice(0, 191);
  if (Object.keys(data).length) await db.lead.update({ where: { id: leadId }, data });
  for (const c of result.contacts) {
    await db.leadContact.upsert({
      where: { leadId_type_normalizedValue: { leadId, type: c.type, normalizedValue: c.normalizedValue.slice(0, 191) } },
      create: { organizationId, leadId, type: c.type, value: c.value.slice(0, 500), normalizedValue: c.normalizedValue.slice(0, 191), source: c.source, sourceUrl: c.sourceUrl, confidence: c.confidence, label: c.label ?? null },
      update: { confidence: c.confidence === "VERIFIED" ? "VERIFIED" : undefined, sourceUrl: c.sourceUrl ?? undefined },
    });
  }
  for (const s of result.socialLinks) {
    if (!s.username && !s.externalId) continue;
    const exists = await db.leadSocialAccount.findFirst({ where: { organizationId, platform: s.platform, OR: [{ username: s.username ?? "-" }, { externalId: s.externalId ?? "-" }] }, select: { id: true } });
    if (exists) continue;
    await db.leadSocialAccount.create({ data: { organizationId, leadId, platform: s.platform, username: s.username, profileUrl: s.profileUrl, externalId: s.externalId, sourceProvider: "website", fetchedAt: new Date() } });
  }
  // Re-score with the new information.
  const updated = await db.lead.findUnique({ where: { id: leadId } });
  if (updated) {
    const score = scoreLead({
      followers: updated.followers,
      website: updated.website,
      websiteIsAggregator: isLinkAggregatorDomain(updated.websiteDomain),
      email: updated.email,
      phone: updated.phone,
      whatsapp: updated.whatsapp,
      isBusiness: null,
      isVerified: null,
      isPrivate: null,
      category: updated.category,
      bio: updated.bio,
      lastPostAt: null,
      country: updated.country,
      city: updated.city,
      providerScore: null,
      brandName: updated.brandName,
    });
    if (score.total > updated.leadScore) await db.lead.update({ where: { id: leadId }, data: { leadScore: score.total, scoreBreakdown: score as unknown as object } });
  }
}

/** Website enrichment for a client record (same rules; contacts stored on ClientContact). */
export async function enrichClientWebsite(db: DbClient, organizationId: string, clientId: string, provider: EnrichmentProvider = new WebsiteEnrichmentProvider()): Promise<EnrichmentResult | null> {
  const client = await db.client.findFirst({ where: { id: clientId, organizationId, deletedAt: null } });
  if (!client?.website) return null;
  const result = await provider.enrich({ id: client.id, platform: "INSTAGRAM", username: null, profileUrl: null, website: client.website });
  const data: Record<string, unknown> = {};
  const pick = (type: string) => result.contacts.find((c) => c.type === type && c.confidence === "VERIFIED") ?? result.contacts.find((c) => c.type === type);
  if (!client.email && pick("EMAIL")) data.email = pick("EMAIL")!.normalizedValue;
  if (!client.phone && pick("PHONE")) data.phone = pick("PHONE")!.normalizedValue;
  if (!client.whatsapp && pick("WHATSAPP")) data.whatsapp = pick("WHATSAPP")!.normalizedValue;
  if (!client.address && pick("ADDRESS")) data.address = pick("ADDRESS")!.value.slice(0, 300);
  if (!client.companyName && result.fields.siteName) data.companyName = result.fields.siteName.slice(0, 191);
  if (result.fields.websiteDomain && !client.websiteDomain) data.websiteDomain = extractDomain(result.fields.website ?? client.website);
  if (Object.keys(data).length) await db.client.update({ where: { id: clientId }, data });
  for (const c of result.contacts) {
    await db.clientContact.upsert({
      where: { clientId_type_normalizedValue: { clientId, type: c.type, normalizedValue: c.normalizedValue.slice(0, 191) } },
      create: { organizationId, clientId, type: c.type, value: c.value.slice(0, 500), normalizedValue: c.normalizedValue.slice(0, 191), source: c.source, sourceUrl: c.sourceUrl, confidence: c.confidence, label: c.label ?? null },
      update: {},
    });
  }
  return result;
}
