import type { DbClient, Lead, Prisma } from "@oses/database";
import { brandKey, createLogger, type Platform } from "@oses/shared";
import { fuzzyMatch, identityKeys } from "./dedupe";
import type { NormalizedLead } from "./normalizer";
import type { ScoredLead } from "./orchestrator";

const log = createLogger("discovery.leads");

export interface PersistBatchInput {
  organizationId: string;
  searchRunId: string;
  leads: ScoredLead[];
}

export interface PersistBatchResult {
  created: number;
  matched: number;
  leadIds: string[];
  /** Leads whose profile details are missing (followers/bio) and should be enriched. */
  needsProfileEnrichment: string[];
  /** Leads with a website but no email/phone; website extraction can add contacts. */
  needsWebsiteEnrichment: string[];
}

/** Look up an existing lead by deterministic identity keys, then by fuzzy brand match. */
export async function findExistingLead(db: DbClient, organizationId: string, lead: NormalizedLead): Promise<{ lead: Lead; matchedBy: string } | null> {
  const or: Prisma.LeadWhereInput[] = [{ dedupeKey: lead.dedupeKey }];
  if (lead.username) or.push({ socialAccounts: { some: { platform: lead.platform, username: lead.username } } });
  if (lead.externalId) or.push({ socialAccounts: { some: { platform: lead.platform, externalId: lead.externalId } } });
  if (lead.websiteDomain && !lead.websiteIsAggregator) or.push({ websiteDomain: lead.websiteDomain });
  if (lead.email) or.push({ email: lead.email }, { contacts: { some: { type: "EMAIL", normalizedValue: lead.email } } });
  if (lead.phone) or.push({ phone: lead.phone }, { contacts: { some: { type: "PHONE", normalizedValue: lead.phone } } });
  for (const s of lead.socialLinks) {
    if (s.username) or.push({ socialAccounts: { some: { platform: s.platform, username: s.username } } });
  }
  const exact = await db.lead.findFirst({ where: { organizationId, deletedAt: null, OR: or }, orderBy: { createdAt: "asc" } });
  if (exact) {
    const matchedBy = exact.dedupeKey === lead.dedupeKey ? "profile" : exact.websiteDomain && exact.websiteDomain === lead.websiteDomain ? "website" : exact.email && exact.email === lead.email ? "email" : exact.phone && exact.phone === lead.phone ? "phone" : "social-account";
    return { lead: exact, matchedBy };
  }
  // Fuzzy: candidates sharing the first significant brand token.
  const key = brandKey(lead.brandName);
  const firstToken = key.split(" ").find((t) => t.length >= 4);
  if (!firstToken) return null;
  const candidates = await db.lead.findMany({ where: { organizationId, deletedAt: null, brandName: { contains: firstToken } }, take: 25 });
  for (const c of candidates) {
    const match = fuzzyMatch(
      { brandName: lead.brandName, username: lead.username, websiteDomain: lead.websiteDomain, email: lead.email, city: lead.city, country: lead.country },
      { brandName: c.brandName, username: c.username, websiteDomain: c.websiteDomain, email: c.email, city: c.city, country: c.country },
    );
    if (match.verdict === "duplicate") return { lead: c, matchedBy: `fuzzy:${match.score.toFixed(2)}` };
  }
  return null;
}

type LeadScalarCreate = Omit<Prisma.LeadUncheckedCreateInput, "organizationId" | "dedupeKey">;

function scalarData(lead: NormalizedLead, score: number, breakdown: unknown): LeadScalarCreate {
  return {
    brandName: lead.brandName,
    name: lead.name,
    primaryPlatform: lead.platform,
    username: lead.username,
    profileUrl: lead.profileUrl,
    inboxUrl: lead.inboxUrl,
    externalId: lead.externalId,
    followers: lead.followers,
    following: lead.following,
    postsCount: lead.postsCount,
    bio: lead.bio,
    website: lead.website,
    websiteDomain: lead.websiteDomain,
    email: lead.email,
    phone: lead.phone,
    whatsapp: lead.whatsapp,
    country: lead.country,
    region: lead.region,
    city: lead.city,
    address: lead.address,
    category: lead.category,
    source: lead.source.provider,
    sourceActor: lead.source.actorId,
    sourceTimestamp: lead.source.fetchedAt,
    leadScore: score,
    scoreBreakdown: breakdown as object,
  };
}

/** Fields to update on an existing lead: fill blanks, refresh volatile metrics when newer data arrived. */
function mergeUpdate(existing: Lead, lead: NormalizedLead, score: number, breakdown: unknown): Prisma.LeadUncheckedUpdateInput {
  const fill = <T>(current: T | null, incoming: T | null): T | null | undefined => (current === null || current === undefined ? incoming ?? undefined : undefined);
  const data: Prisma.LeadUncheckedUpdateInput = {
    lastSeenAt: new Date(),
    name: fill(existing.name, lead.name),
    bio: fill(existing.bio, lead.bio),
    website: fill(existing.website, lead.website),
    websiteDomain: fill(existing.websiteDomain, lead.websiteDomain),
    email: fill(existing.email, lead.email),
    phone: fill(existing.phone, lead.phone),
    whatsapp: fill(existing.whatsapp, lead.whatsapp),
    country: fill(existing.country, lead.country),
    region: fill(existing.region, lead.region),
    city: fill(existing.city, lead.city),
    address: fill(existing.address, lead.address),
    category: fill(existing.category, lead.category),
    externalId: fill(existing.externalId, lead.externalId),
    inboxUrl: fill(existing.inboxUrl, lead.inboxUrl),
    username: fill(existing.username, lead.username),
    primaryPlatform: existing.primaryPlatform ?? lead.platform,
  };
  if (lead.followers != null) data.followers = lead.followers;
  if (lead.following != null) data.following = lead.following;
  if (lead.postsCount != null) data.postsCount = lead.postsCount;
  if (score > existing.leadScore) {
    data.leadScore = score;
    data.scoreBreakdown = breakdown as object;
  }
  // Remove undefined keys so Prisma does not touch them.
  for (const k of Object.keys(data) as Array<keyof typeof data>) if (data[k] === undefined) delete data[k];
  return data;
}

async function upsertSocialAccount(db: DbClient, organizationId: string, leadId: string, lead: NormalizedLead, providerRunId: string | null): Promise<void> {
  const data = {
    profileUrl: lead.profileUrl,
    externalId: lead.externalId,
    inboxUrl: lead.inboxUrl,
    displayName: lead.name,
    followers: lead.followers,
    following: lead.following,
    postsCount: lead.postsCount,
    bio: lead.bio,
    category: lead.category,
    isBusiness: lead.isBusiness,
    isVerified: lead.isVerified,
    isPrivate: lead.isPrivate,
    website: lead.website,
    email: lead.email,
    phone: lead.phone,
    lastPostAt: lead.lastPostAt,
    raw: lead.raw as object,
    sourceProvider: lead.source.provider,
    sourceActor: lead.source.actorId,
    providerRunId,
    fetchedAt: lead.source.fetchedAt,
  };
  if (lead.username) {
    await db.leadSocialAccount.upsert({
      where: { organizationId_platform_username: { organizationId, platform: lead.platform, username: lead.username } },
      create: { organizationId, leadId, platform: lead.platform, username: lead.username, ...data },
      update: { leadId, ...stripNulls(data) },
    });
  } else {
    const existing = await db.leadSocialAccount.findFirst({ where: { organizationId, platform: lead.platform, OR: [{ externalId: lead.externalId ?? "-" }, { profileUrl: lead.profileUrl }] } });
    if (existing) await db.leadSocialAccount.update({ where: { id: existing.id }, data: { leadId, ...stripNulls(data) } });
    else await db.leadSocialAccount.create({ data: { organizationId, leadId, platform: lead.platform, username: null, ...data } });
  }
  for (const s of lead.socialLinks) {
    if (!s.username && !s.externalId) continue;
    const exists = await db.leadSocialAccount.findFirst({ where: { organizationId, platform: s.platform, OR: [{ username: s.username ?? "-" }, { externalId: s.externalId ?? "-" }] } });
    if (exists) continue;
    await db.leadSocialAccount.create({
      data: { organizationId, leadId, platform: s.platform, username: s.username, profileUrl: s.profileUrl, externalId: s.externalId, sourceProvider: lead.source.provider, sourceActor: lead.source.actorId, fetchedAt: lead.source.fetchedAt },
    });
  }
}

function stripNulls<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== null && v !== undefined) (out as Record<string, unknown>)[k] = v;
  return out;
}

async function upsertContacts(db: DbClient, organizationId: string, leadId: string, lead: NormalizedLead): Promise<void> {
  for (const c of lead.contacts) {
    await db.leadContact.upsert({
      where: { leadId_type_normalizedValue: { leadId, type: c.type, normalizedValue: c.normalizedValue.slice(0, 191) } },
      create: { organizationId, leadId, type: c.type, value: c.value.slice(0, 500), normalizedValue: c.normalizedValue.slice(0, 191), source: c.source, sourceUrl: c.sourceUrl ?? null, confidence: c.confidence, label: c.label ?? null },
      update: {},
    });
  }
}

/** Persist a discovery batch: match existing leads, create new ones, link them to the search run. */
export async function persistDiscoveredLeads(db: DbClient, input: PersistBatchInput, providerRunIdByExternalId: Map<string, string> = new Map()): Promise<PersistBatchResult> {
  const result: PersistBatchResult = { created: 0, matched: 0, leadIds: [], needsProfileEnrichment: [], needsWebsiteEnrichment: [] };
  let rank = 0;
  for (const lead of input.leads) {
    rank++;
    const providerRunId = lead.source.externalRunId ? providerRunIdByExternalId.get(lead.source.externalRunId) ?? null : null;
    try {
      const existing = await findExistingLead(db, input.organizationId, lead);
      let leadId: string;
      if (existing) {
        await db.lead.update({ where: { id: existing.lead.id }, data: mergeUpdate(existing.lead, lead, lead.score.total, lead.score) });
        leadId = existing.lead.id;
        result.matched++;
      } else {
        const created = await db.lead.create({
          data: {
            organizationId: input.organizationId,
            dedupeKey: lead.dedupeKey,
            firstSearchRunId: input.searchRunId,
            ...scalarData(lead, lead.score.total, lead.score),
          },
        });
        leadId = created.id;
        result.created++;
      }
      await upsertSocialAccount(db, input.organizationId, leadId, lead, providerRunId);
      await upsertContacts(db, input.organizationId, leadId, lead);
      await db.searchRunLead.upsert({
        where: { searchRunId_leadId: { searchRunId: input.searchRunId, leadId } },
        create: { searchRunId: input.searchRunId, leadId, rank, matchedExisting: Boolean(existing), matchedBy: existing?.matchedBy ?? null },
        update: { rank },
      });
      result.leadIds.push(leadId);
      if (lead.followers == null || lead.bio == null) result.needsProfileEnrichment.push(leadId);
      if (lead.website && !lead.websiteIsAggregator && (!lead.email || !lead.phone)) result.needsWebsiteEnrichment.push(leadId);
      else if (lead.website && lead.websiteIsAggregator) result.needsWebsiteEnrichment.push(leadId);
    } catch (err) {
      log.error("failed to persist lead", { dedupeKey: lead.dedupeKey, error: (err as Error).message });
    }
  }
  return result;
}

/** Apply provider profile details (enrichment) onto an existing lead. */
export async function applyProfileToLead(db: DbClient, organizationId: string, leadId: string, lead: NormalizedLead, score: { total: number; breakdown: unknown }): Promise<void> {
  const existing = await db.lead.findFirst({ where: { id: leadId, organizationId } });
  if (!existing) return;
  const data = mergeUpdate(existing, lead, score.total, score.breakdown);
  await db.lead.update({ where: { id: leadId }, data: { ...data, enrichmentStatus: "COMPLETED", enrichedAt: new Date(), enrichmentError: null } });
  await upsertSocialAccount(db, organizationId, leadId, lead, null);
  await upsertContacts(db, organizationId, leadId, lead);
}

export function platformOf(lead: Pick<Lead, "primaryPlatform">): Platform {
  return lead.primaryPlatform ?? "INSTAGRAM";
}

export { identityKeys };
