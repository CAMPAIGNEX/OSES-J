import { normalizeText } from "@oses/shared";
import type { NormalizedLead } from "./normalizer";
import type { SearchCriteria } from "./types";

export interface ScoreBreakdown {
  total: number;
  parts: Record<string, number>;
  notes: string[];
}

const RELEVANT_TERMS = [
  "apparel", "clothing", "streetwear", "sportswear", "activewear", "athleisure", "fitness", "gym", "hoodie", "hoodies",
  "t-shirt", "tshirt", "tee", "jersey", "tracksuit", "leggings", "socks", "wear", "brand", "label", "fashion", "boutique",
  "collection", "drop", "shop now", "worldwide shipping", "private label", "custom", "wholesale",
];

export type ScorableLead = Pick<
  NormalizedLead,
  "followers" | "website" | "websiteIsAggregator" | "email" | "phone" | "whatsapp" | "isBusiness" | "isVerified" | "isPrivate" | "category" | "bio" | "lastPostAt" | "country" | "city" | "providerScore" | "brandName"
>;

/**
 * 0..100 heuristic lead score. Transparent (breakdown is stored) so users can see why a lead ranks high.
 * It never pretends to know things the data does not contain: unknown values score 0, not negative.
 */
export function scoreLead(lead: ScorableLead, criteria?: Pick<SearchCriteria, "minFollowers" | "maxFollowers" | "keywords" | "location">): ScoreBreakdown {
  const parts: Record<string, number> = {};
  const notes: string[] = [];

  if (lead.followers != null) {
    const f = lead.followers;
    const min = criteria?.minFollowers ?? null;
    const max = criteria?.maxFollowers ?? null;
    if ((min == null || f >= min) && (max == null || f <= max)) {
      parts.followers = 20;
    } else if (min != null && f < min) {
      parts.followers = Math.max(0, Math.round(20 * (f / min)) - 5);
      notes.push("below requested follower range");
    } else {
      parts.followers = 8;
      notes.push("above requested follower range");
    }
    if (f >= 1000 && f <= 250_000) parts.followers += 5;
  } else {
    parts.followers = 0;
    notes.push("follower count unknown");
  }

  parts.website = lead.website ? (lead.websiteIsAggregator ? 8 : 15) : 0;
  parts.email = lead.email ? 15 : 0;
  parts.phone = lead.phone ? 6 : 0;
  parts.whatsapp = lead.whatsapp ? 6 : 0;
  parts.business = lead.isBusiness ? 8 : 0;
  parts.verified = lead.isVerified ? 3 : 0;

  const text = normalizeText([lead.brandName, lead.category, lead.bio].filter(Boolean).join(" "));
  let relevance = 0;
  for (const term of RELEVANT_TERMS) if (text.includes(normalizeText(term))) relevance += 2;
  for (const kw of criteria?.keywords ?? []) if (kw && text.includes(normalizeText(kw))) relevance += 4;
  parts.relevance = Math.min(15, relevance);

  let location = 0;
  if (criteria?.location) {
    const city = criteria.location.city ? normalizeText(criteria.location.city) : null;
    const country = criteria.location.country ? normalizeText(criteria.location.country) : null;
    const leadLoc = normalizeText([lead.city, lead.country, lead.bio].filter(Boolean).join(" "));
    if (city && leadLoc.includes(city)) location += 6;
    if (country && leadLoc.includes(country)) location += 2;
  }
  parts.location = Math.min(8, location);

  if (lead.lastPostAt) {
    const days = (Date.now() - lead.lastPostAt.getTime()) / 86_400_000;
    parts.activity = days <= 30 ? 6 : days <= 90 ? 3 : 0;
    if (days > 180) notes.push("no recent posts");
  } else parts.activity = 0;

  parts.provider = lead.providerScore != null ? Math.round(lead.providerScore * 4) : 0;
  parts.penalty = lead.isPrivate ? -20 : 0;
  if (lead.isPrivate) notes.push("private account");

  const total = Math.max(0, Math.min(100, Object.values(parts).reduce((a, b) => a + b, 0)));
  return { total, parts, notes };
}
