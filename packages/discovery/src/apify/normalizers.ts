import { buildProfileUrl, extractEmails, extractUrls, extractWhatsAppNumbers, normalizeEmail, normalizePhone, normalizeUsername, parseSocialUrl } from "@oses/shared";
import type { DiscoveryResult, DiscoverySource } from "../types";

/**
 * Lenient field extraction for Actor dataset items.
 *
 * Different Apify Actors (and different versions of the same Actor) name fields differently.
 * These helpers look at a list of candidate keys so an Actor swap does not require code changes
 * for the common cases; unknown shapes still keep the raw item for inspection.
 */

type Item = Record<string, unknown>;

export function pick<T = unknown>(item: Item, keys: string[]): T | undefined {
  for (const key of keys) {
    const parts = key.split(".");
    let cur: unknown = item;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in (cur as Item)) cur = (cur as Item)[p];
      else {
        cur = undefined;
        break;
      }
    }
    if (cur !== undefined && cur !== null && cur !== "") return cur as T;
  }
  return undefined;
}

export function pickString(item: Item, keys: string[]): string | null {
  const v = pick(item, keys);
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  return null;
}

export function pickNumber(item: Item, keys: string[]): number | null {
  const v = pick(item, keys);
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  if (typeof v === "string") {
    const parsed = parseCompactNumber(v);
    if (parsed !== null) return parsed;
  }
  return null;
}

export function pickBoolean(item: Item, keys: string[]): boolean | null {
  const v = pick(item, keys);
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    if (/^(true|yes|1)$/i.test(v)) return true;
    if (/^(false|no|0)$/i.test(v)) return false;
  }
  return null;
}

export function pickDate(item: Item, keys: string[]): Date | null {
  const v = pick(item, keys);
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(v < 1e12 ? v * 1000 : v);
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** "12.5K" -> 12500, "1,234" -> 1234, "2M" -> 2000000 */
export function parseCompactNumber(input: string): number | null {
  const s = input.trim().replace(/,/g, "");
  const m = /^([\d.]+)\s*([kKmMbB])?$/.exec(s);
  if (!m) return null;
  const n = Number.parseFloat(m[1] ?? "");
  if (!Number.isFinite(n)) return null;
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] ?? "").toLowerCase()] ?? 1;
  return Math.round(n * mult);
}

export interface NormalizeOptions {
  source: DiscoverySource;
  providerScore?: number | null;
}

/** Normalize an Instagram profile-like item (instagram-scraper "details", instagram-profile-scraper, search results). */
export function normalizeInstagramProfile(item: Item, opts: NormalizeOptions): DiscoveryResult | null {
  const usernameRaw = pickString(item, ["username", "ownerUsername", "userName", "handle", "user.username", "owner.username"]);
  const urlRaw = pickString(item, ["url", "profileUrl", "inputUrl", "user.url"]);
  let username = normalizeUsername(usernameRaw);
  if (!username && urlRaw) username = parseSocialUrl(urlRaw)?.username ?? null;
  if (!username) return null;
  const bio = pickString(item, ["biography", "bio", "description", "user.biography"]);
  const externalUrl = pickString(item, ["externalUrl", "external_url", "website", "externalUrls.0.url", "bioLinks.0.url"]);
  const bioLinks = Array.isArray(item.bioLinks) ? (item.bioLinks as Item[]).map((l) => pickString(l, ["url", "link"])).filter((x): x is string => Boolean(x)) : [];
  const links = [...new Set([...(externalUrl ? [externalUrl] : []), ...bioLinks, ...extractUrls(bio)])];
  const email = normalizeEmail(pickString(item, ["businessEmail", "business_email", "publicEmail", "public_email", "email"])) ?? extractEmails(bio)[0] ?? null;
  const phone = normalizePhone(pickString(item, ["businessPhoneNumber", "business_phone_number", "publicPhoneNumber", "contactPhoneNumber", "phone"]));
  const whatsapp = extractWhatsAppNumbers([bio ?? "", ...links].join(" "))[0] ?? null;
  const addr = pick<Item | string>(item, ["businessAddressJson", "business_address_json", "addressJson", "address"]);
  let location: DiscoveryResult["location"] = null;
  if (addr) {
    let parsed: Item | null = null;
    if (typeof addr === "string") {
      try {
        parsed = JSON.parse(addr) as Item;
      } catch {
        parsed = { street_address: addr };
      }
    } else parsed = addr;
    if (parsed) {
      const city = pickString(parsed, ["city_name", "city", "cityName"]);
      const region = pickString(parsed, ["region_name", "region", "state"]);
      const country = pickString(parsed, ["country_code", "country", "countryCode"]);
      const street = pickString(parsed, ["street_address", "street", "address"]);
      if (city || region || country || street) location = { city, region, country, address: street };
    }
  }
  const latestPosts = Array.isArray(item.latestPosts) ? (item.latestPosts as Item[]) : [];
  const lastPostAt = latestPosts.length ? pickDate(latestPosts[0] as Item, ["timestamp", "takenAt", "taken_at"]) : pickDate(item, ["latestPostTimestamp", "lastPostAt"]);
  return {
    platform: "INSTAGRAM",
    username,
    profileUrl: buildProfileUrl("INSTAGRAM", username),
    externalId: pickString(item, ["id", "userId", "user_id", "ownerId", "pk", "user.id"]),
    displayName: pickString(item, ["fullName", "full_name", "name", "ownerFullName", "user.full_name"]),
    followers: pickNumber(item, ["followersCount", "followers_count", "followers", "followerCount", "edge_followed_by.count"]),
    following: pickNumber(item, ["followsCount", "follows_count", "following", "followingCount", "edge_follow.count"]),
    postsCount: pickNumber(item, ["postsCount", "posts_count", "mediaCount", "media_count", "edge_owner_to_timeline_media.count"]),
    bio,
    website: externalUrl,
    email,
    phone: phone ?? whatsapp,
    category: pickString(item, ["businessCategoryName", "business_category_name", "category", "categoryName"]),
    isBusiness: pickBoolean(item, ["isBusinessAccount", "is_business_account", "isBusiness", "is_business"]),
    isVerified: pickBoolean(item, ["verified", "isVerified", "is_verified"]),
    isPrivate: pickBoolean(item, ["private", "isPrivate", "is_private"]),
    location,
    lastPostAt,
    providerScore: opts.providerScore ?? null,
    links,
    raw: item,
    source: opts.source,
  };
}

/** Normalize a Facebook page-like item (facebook-pages-scraper, facebook-search-scraper pages). */
export function normalizeFacebookPage(item: Item, opts: NormalizeOptions): DiscoveryResult | null {
  const urlRaw = pickString(item, ["pageUrl", "facebookUrl", "url", "facebookId", "link", "inputUrl"]);
  const parsed = urlRaw ? parseSocialUrl(urlRaw) : null;
  const externalId = pickString(item, ["pageId", "id", "facebookId", "page_id"]);
  const username = parsed?.username ?? normalizeUsername(pickString(item, ["username", "pageUsername", "vanity"]));
  const profileUrl = parsed?.profileUrl ?? (username ? buildProfileUrl("FACEBOOK", username) : externalId ? `https://www.facebook.com/${externalId}` : null);
  if (!profileUrl) return null;
  const about = pickString(item, ["intro", "about", "description", "info", "bio", "pageIntro"]);
  const website = pickString(item, ["website", "websites.0", "links.0", "externalUrl"]);
  const email = normalizeEmail(pickString(item, ["email", "emails.0", "contactEmail"])) ?? extractEmails(about)[0] ?? null;
  const phone = normalizePhone(pickString(item, ["phone", "phones.0", "phoneNumber", "contactPhone"]));
  const categories = pick<unknown>(item, ["categories", "category", "pageCategory"]);
  const category = Array.isArray(categories) ? categories.filter((c): c is string => typeof c === "string").join(", ") : typeof categories === "string" ? categories : null;
  const addressRaw = pick<unknown>(item, ["address", "location", "addressText"]);
  let location: DiscoveryResult["location"] = null;
  if (typeof addressRaw === "string" && addressRaw.trim()) location = { address: addressRaw.trim() };
  else if (addressRaw && typeof addressRaw === "object") {
    const a = addressRaw as Item;
    location = {
      address: pickString(a, ["street", "address", "formatted", "text"]),
      city: pickString(a, ["city"]),
      region: pickString(a, ["state", "region"]),
      country: pickString(a, ["country", "countryCode"]),
    };
  }
  return {
    platform: "FACEBOOK",
    username: username ?? null,
    profileUrl,
    externalId: externalId ?? parsed?.externalId ?? null,
    displayName: pickString(item, ["title", "pageName", "name", "page_name"]),
    followers: pickNumber(item, ["followers", "followersCount", "followerCount", "likes", "likesCount"]),
    following: null,
    postsCount: null,
    bio: about,
    website,
    email,
    phone,
    category,
    isBusiness: true,
    isVerified: pickBoolean(item, ["verified", "isVerified", "is_verified"]),
    isPrivate: false,
    location,
    lastPostAt: null,
    providerScore: opts.providerScore ?? null,
    links: [...new Set([...(website ? [website] : []), ...extractUrls(about)])],
    raw: item,
    source: opts.source,
  };
}
