import { brandKey, diceCoefficient, emailDomain, isFreeMailDomain, jaroWinkler, normalizeText } from "@oses/shared";
import type { NormalizedLead } from "./normalizer";

/**
 * Deduplication.
 *
 * 1. Deterministic identity keys (profile, external id, website domain, email, phone) — exact matches.
 * 2. Fuzzy entity matching (brand name similarity + corroborating signals) — scored.
 * 3. Ambiguous pairs can be handed to an optional AI resolver by the caller.
 */

export interface IdentityKeyed {
  platform: NormalizedLead["platform"];
  username: string | null;
  externalId: string | null;
  websiteDomain: string | null;
  websiteIsAggregator?: boolean;
  email: string | null;
  phone: string | null;
  whatsapp?: string | null;
  socialLinks?: NormalizedLead["socialLinks"];
}

export function identityKeys(lead: IdentityKeyed): string[] {
  const keys: string[] = [];
  const p = lead.platform === "INSTAGRAM" ? "ig" : "fb";
  if (lead.username) keys.push(`${p}:user:${lead.username}`);
  if (lead.externalId) keys.push(`${p}:id:${lead.externalId}`);
  if (lead.websiteDomain && !lead.websiteIsAggregator) keys.push(`web:${lead.websiteDomain}`);
  if (lead.email) keys.push(`email:${lead.email}`);
  if (lead.phone) keys.push(`phone:${lead.phone}`);
  if (lead.whatsapp) keys.push(`phone:${lead.whatsapp}`);
  for (const s of lead.socialLinks ?? []) {
    const sp = s.platform === "INSTAGRAM" ? "ig" : "fb";
    if (s.username) keys.push(`${sp}:user:${s.username}`);
    else if (s.externalId) keys.push(`${sp}:id:${s.externalId}`);
  }
  return [...new Set(keys)];
}

/** Merge `incoming` into `primary`, filling only missing information. Contacts and links are unioned. */
export function mergeNormalizedLeads(primary: NormalizedLead, incoming: NormalizedLead): NormalizedLead {
  const fill = <T>(a: T | null | undefined, b: T | null | undefined): T | null => (a !== null && a !== undefined ? a : b ?? null);
  const contacts = [...primary.contacts];
  for (const c of incoming.contacts) {
    if (!contacts.some((x) => x.type === c.type && x.normalizedValue === c.normalizedValue)) contacts.push(c);
  }
  const socialLinks = [...primary.socialLinks];
  for (const s of incoming.socialLinks) {
    if (!socialLinks.some((x) => x.platform === s.platform && x.profileUrl === s.profileUrl)) socialLinks.push(s);
  }
  return {
    ...primary,
    name: fill(primary.name, incoming.name),
    followers: fill(primary.followers, incoming.followers),
    following: fill(primary.following, incoming.following),
    postsCount: fill(primary.postsCount, incoming.postsCount),
    bio: fill(primary.bio, incoming.bio),
    website: primary.website && !primary.websiteIsAggregator ? primary.website : incoming.website && !incoming.websiteIsAggregator ? incoming.website : fill(primary.website, incoming.website),
    websiteDomain: primary.websiteDomain && !primary.websiteIsAggregator ? primary.websiteDomain : incoming.websiteDomain && !incoming.websiteIsAggregator ? incoming.websiteDomain : fill(primary.websiteDomain, incoming.websiteDomain),
    websiteIsAggregator: primary.websiteDomain && !primary.websiteIsAggregator ? false : incoming.websiteDomain && !incoming.websiteIsAggregator ? false : primary.websiteIsAggregator || incoming.websiteIsAggregator,
    email: fill(primary.email, incoming.email),
    phone: fill(primary.phone, incoming.phone),
    whatsapp: fill(primary.whatsapp, incoming.whatsapp),
    country: fill(primary.country, incoming.country),
    region: fill(primary.region, incoming.region),
    city: fill(primary.city, incoming.city),
    address: fill(primary.address, incoming.address),
    category: fill(primary.category, incoming.category),
    isBusiness: fill(primary.isBusiness, incoming.isBusiness),
    isVerified: fill(primary.isVerified, incoming.isVerified),
    isPrivate: fill(primary.isPrivate, incoming.isPrivate),
    lastPostAt: fill(primary.lastPostAt, incoming.lastPostAt),
    externalId: fill(primary.externalId, incoming.externalId),
    providerScore: Math.max(primary.providerScore ?? 0, incoming.providerScore ?? 0) || null,
    links: [...new Set([...primary.links, ...incoming.links])],
    contacts,
    socialLinks,
  };
}

export interface BatchDedupeResult {
  leads: NormalizedLead[];
  /** number of incoming records merged into another record */
  merged: number;
}

/** Collapse duplicates inside one batch using deterministic identity keys. */
export function dedupeBatch(leads: NormalizedLead[]): BatchDedupeResult {
  const keyToIndex = new Map<string, number>();
  const out: NormalizedLead[] = [];
  let merged = 0;
  for (const lead of leads) {
    const keys = identityKeys(lead);
    const existingIdx = keys.map((k) => keyToIndex.get(k)).find((i): i is number => i !== undefined);
    if (existingIdx === undefined) {
      out.push(lead);
      const idx = out.length - 1;
      for (const k of keys) keyToIndex.set(k, idx);
      continue;
    }
    const current = out[existingIdx]!;
    // Same platform + same account → merge; different platform accounts of the same business also merge
    // (keys only collide on strong signals: shared website, email or phone).
    out[existingIdx] = mergeNormalizedLeads(current, lead);
    merged++;
    for (const k of identityKeys(out[existingIdx]!)) keyToIndex.set(k, existingIdx);
  }
  return { leads: out, merged };
}

export interface FuzzyMatchInput {
  brandName: string;
  username?: string | null;
  websiteDomain?: string | null;
  email?: string | null;
  city?: string | null;
  country?: string | null;
  bio?: string | null;
}

export interface FuzzyMatchResult {
  score: number;
  verdict: "duplicate" | "ambiguous" | "different";
  reasons: string[];
}

/**
 * Score how likely two records describe the same business (0..1).
 * Brand-name similarity is the base; websites, email domains and location corroborate.
 */
export function fuzzyMatch(a: FuzzyMatchInput, b: FuzzyMatchInput): FuzzyMatchResult {
  const reasons: string[] = [];
  const ka = brandKey(a.brandName);
  const kb = brandKey(b.brandName);
  let score = 0;
  if (ka && kb) {
    const jw = jaroWinkler(ka, kb);
    const dice = diceCoefficient(ka, kb);
    const nameScore = Math.max(jw, dice);
    score = nameScore * 0.7;
    if (nameScore >= 0.92) reasons.push(`brand names nearly identical (${nameScore.toFixed(2)})`);
    else if (nameScore >= 0.8) reasons.push(`brand names similar (${nameScore.toFixed(2)})`);
  }
  if (a.username && b.username) {
    const u = jaroWinkler(a.username.replace(/[._]/g, ""), b.username.replace(/[._]/g, ""));
    if (u >= 0.9) {
      score += 0.15;
      reasons.push("usernames match closely");
    }
  }
  if (a.websiteDomain && b.websiteDomain) {
    if (a.websiteDomain === b.websiteDomain) {
      score += 0.3;
      reasons.push("same website domain");
    } else score -= 0.2;
  }
  const da = emailDomain(a.email);
  const db = emailDomain(b.email);
  if (da && db && da === db && !isFreeMailDomain(da)) {
    score += 0.25;
    reasons.push("same email domain");
  }
  if (a.city && b.city) {
    if (normalizeText(a.city) === normalizeText(b.city)) {
      score += 0.05;
      reasons.push("same city");
    } else score -= 0.1;
  }
  if (a.country && b.country && normalizeText(a.country) !== normalizeText(b.country)) score -= 0.15;
  score = Math.max(0, Math.min(1, score));
  const verdict: FuzzyMatchResult["verdict"] = score >= 0.9 ? "duplicate" : score >= 0.72 ? "ambiguous" : "different";
  return { score, verdict, reasons };
}

/** Optional secondary resolver (AI) for ambiguous fuzzy matches. */
export interface DuplicateResolver {
  resolve(a: FuzzyMatchInput, b: FuzzyMatchInput, hint: FuzzyMatchResult): Promise<{ sameBusiness: boolean; confidence: number; reasoning?: string }>;
}
