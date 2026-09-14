import { CITY_TZ, normalizeCountryCode, normalizeText, REGION_TZ, type Platform } from "@oses/shared";
import { searchCriteriaSchema, type SearchCriteriaRequest } from "@oses/validation";
import type { SearchCriteria } from "./types";

/**
 * Deterministic parser for free-text lead queries such as
 *   "New apparel brands in New York"
 *   "streetwear brands based in London, UK"
 *   "fitness wear labels Berlin"
 *
 * It extracts keywords, product categories and a location. Explicit form fields
 * (country/city/keywords) always win over what is parsed from the text.
 */

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  apparel: ["apparel", "clothing", "clothes", "fashion label", "garment"],
  streetwear: ["streetwear", "street wear", "urban wear"],
  sportswear: ["sportswear", "sports wear", "athletic wear", "activewear", "active wear", "athleisure"],
  fitness: ["fitness wear", "fitness apparel", "fitness brand", "fitness gear", "workout clothes", "training wear"],
  gymwear: ["gym wear", "gymwear", "gym apparel", "gym clothing"],
  hoodies: ["hoodie", "hoodies", "sweatshirt", "sweatshirts"],
  tshirts: ["t-shirt", "t-shirts", "tshirt", "tshirts", "tee", "tees"],
  jerseys: ["jersey", "jerseys", "team wear", "teamwear", "uniforms"],
  tracksuits: ["tracksuit", "tracksuits", "joggers", "sweatpants"],
  hosiery: ["hosiery", "socks", "leggings", "tights"],
  accessories: ["fitness accessories", "gym accessories", "sports accessories", "lifting straps", "gloves"],
};

const FILLER = new Set([
  "new", "top", "best", "small", "emerging", "upcoming", "growing", "independent", "indie", "local", "popular", "leading",
  "brands", "brand", "companies", "company", "labels", "label", "stores", "store", "shops", "shop", "businesses", "business",
  "find", "search", "looking", "for", "the", "a", "an", "of", "and", "with", "that", "who", "sell", "selling", "on", "instagram", "facebook",
]);

const LOCATION_PREPOSITIONS = [" based in ", " located in ", " from ", " in ", " near ", " around ", " at "];

export interface ParsedQuery {
  keywords: string[];
  categories: string[];
  location: { country: string | null; countryCode: string | null; region: string | null; city: string | null };
  recencyHint: boolean;
}

function detectCategories(text: string): string[] {
  const n = ` ${normalizeText(text)} `;
  const found: string[] = [];
  for (const [category, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some((w) => n.includes(` ${normalizeText(w)} `))) found.push(category);
  }
  return found;
}

function resolvePlace(place: string): ParsedQuery["location"] {
  const cleaned = place.replace(/[.!?]+$/, "").trim();
  const parts = cleaned.split(/\s*,\s*/).filter(Boolean);
  const loc: ParsedQuery["location"] = { country: null, countryCode: null, region: null, city: null };
  for (const part of parts) {
    const key = normalizeText(part);
    const cc = normalizeCountryCode(part);
    if (cc && !loc.countryCode) {
      loc.countryCode = cc;
      loc.country = part.trim();
      continue;
    }
    if (CITY_TZ[key] && !loc.city) {
      loc.city = titleCaseWords(part);
      continue;
    }
    const regionCountry = Object.entries(REGION_TZ).find(([, regions]) => Boolean(regions[key]));
    if (regionCountry && !loc.region) {
      loc.region = titleCaseWords(part);
      if (!loc.countryCode) loc.countryCode = regionCountry[0] ?? null;
      continue;
    }
    if (!loc.city) loc.city = titleCaseWords(part);
    else if (!loc.region) loc.region = titleCaseWords(part);
  }
  // A city implies its country when we know it (e.g. "New York" -> US) via the region tables.
  if (loc.city && !loc.countryCode) {
    const cityKey = normalizeText(loc.city);
    for (const [cc, regions] of Object.entries(REGION_TZ)) {
      if (regions[cityKey]) {
        loc.countryCode = cc;
        break;
      }
    }
    if (!loc.countryCode) {
      const tz = CITY_TZ[cityKey];
      if (tz) loc.countryCode = countryFromTimezone(tz);
    }
  }
  if (loc.countryCode && !loc.country) loc.country = loc.countryCode;
  return loc;
}

function countryFromTimezone(tz: string): string | null {
  if (tz.startsWith("America/") && ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Phoenix", "America/Detroit", "America/Indiana/Indianapolis", "America/Anchorage", "Pacific/Honolulu"].includes(tz)) return "US";
  if (["America/Toronto", "America/Vancouver", "America/Edmonton", "America/Winnipeg", "America/Halifax"].includes(tz)) return "CA";
  if (tz.startsWith("Australia/")) return "AU";
  if (tz === "Europe/London") return "GB";
  return null;
}

function titleCaseWords(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export function parseQuery(query: string): ParsedQuery {
  const text = ` ${query.replace(/\s+/g, " ").trim()} `;
  let subject = text;
  let location: ParsedQuery["location"] = { country: null, countryCode: null, region: null, city: null };

  for (const prep of LOCATION_PREPOSITIONS) {
    const idx = text.toLowerCase().lastIndexOf(prep);
    if (idx > 0) {
      const place = text.slice(idx + prep.length).trim();
      if (place && place.split(" ").length <= 5) {
        location = resolvePlace(place);
        subject = text.slice(0, idx);
        break;
      }
    }
  }
  // Fallback: trailing known city/country without a preposition ("streetwear brands London")
  if (!location.city && !location.countryCode) {
    const words = subject.trim().split(" ");
    for (let take = Math.min(3, words.length - 1); take >= 1; take--) {
      const tail = words.slice(-take).join(" ");
      const key = normalizeText(tail);
      if (CITY_TZ[key] || normalizeCountryCode(tail)) {
        location = resolvePlace(tail);
        subject = words.slice(0, words.length - take).join(" ");
        break;
      }
    }
  }

  const categories = detectCategories(subject);
  const recencyHint = /\b(new|emerging|upcoming|startup|start-up)\b/i.test(subject);
  const keywords = normalizeText(subject)
    .split(" ")
    .filter((w) => w && !FILLER.has(w) && w.length > 1);
  // Keep multi-word category phrases intact when present.
  const phraseKeywords: string[] = [];
  const n = ` ${normalizeText(subject)} `;
  for (const words of Object.values(CATEGORY_KEYWORDS)) {
    for (const w of words) {
      const nw = normalizeText(w);
      if (nw.includes(" ") && n.includes(` ${nw} `)) phraseKeywords.push(nw);
    }
  }
  const merged = [...new Set([...phraseKeywords, ...keywords.filter((k) => !phraseKeywords.some((p) => p.split(" ").includes(k)))])];
  return { keywords: merged.slice(0, 8), categories, location, recencyHint };
}

export function toHashtags(keywords: string[]): string[] {
  return [...new Set(keywords.map((k) => normalizeText(k).replace(/\s+/g, "")).filter((k) => k.length >= 3 && k.length <= 30))].slice(0, 6);
}

/** Merge parsed text with explicit form input into normalized SearchCriteria. */
export function buildSearchCriteria(request: SearchCriteriaRequest): SearchCriteria {
  const input = searchCriteriaSchema.parse(request);
  const parsed = parseQuery(input.query);
  const platforms: Platform[] = input.platform === "BOTH" ? ["INSTAGRAM", "FACEBOOK"] : [input.platform];
  const keywords = [...new Set([...(input.keywords ?? []).map((k) => normalizeText(k)).filter(Boolean), ...parsed.keywords])];
  const country = input.country ?? parsed.location.country;
  const countryCode = normalizeCountryCode(country) ?? parsed.location.countryCode;
  return {
    query: input.query.trim(),
    keywords: keywords.length ? keywords : parsed.categories.length ? parsed.categories : [normalizeText(input.query)],
    platforms,
    minFollowers: input.minFollowers ?? null,
    maxFollowers: input.maxFollowers ?? null,
    location: {
      country: country ?? null,
      countryCode,
      region: input.region ?? parsed.location.region,
      city: input.city ?? parsed.location.city,
    },
    category: input.category ?? (parsed.categories[0] ?? null),
    limit: input.limit,
    strategy: input.strategy,
    filters: input.filters ?? {},
    enrich: input.enrich,
    hashtags: toHashtags(keywords.length ? keywords : parsed.keywords),
  };
}

/** Human-readable location string for search inputs, e.g. "New York, US". */
export function locationText(location: SearchCriteria["location"]): string {
  return [location.city, location.region, location.country ?? location.countryCode].filter(Boolean).join(", ");
}
