import { normalizeUsername, parseSocialUrl, type Platform } from "@oses/shared";
import type { ContentCriteria, ContentResult, DiscoveryResult, DiscoverySource, SearchCriteria } from "../types";
import { locationText } from "../query-parser";
import { normalizeFacebookPage, normalizeInstagramProfile, parseCompactNumber, pickDate, pickNumber, pickString } from "./normalizers";

type Item = Record<string, unknown>;

export interface ProfileTarget {
  username: string | null;
  profileUrl: string;
  externalId?: string | null;
}

export type AdapterPurpose = "DISCOVERY" | "PROFILE" | "CONTENT";

/** Free-form settings stored on ProviderConfig.settings. */
export interface AdapterSettings {
  /** Object merged over the adapter's default Actor input (lets operators adapt to Actor schema changes without code). */
  inputOverrides?: Record<string, unknown>;
  /** Cap on dataset items to read. */
  maxItems?: number;
  /** Search-engine adapter: Google country code (e.g. "us"). */
  countryCode?: string;
  [key: string]: unknown;
}

/**
 * An ActorAdapter knows how to talk to one family of Apify Actors: how to build its input from
 * OSES J criteria and how to turn its dataset items into normalized results.
 *
 * Field names below reflect the public schemas of the referenced Actors at the time of writing.
 * Because Actors evolve, every adapter tolerates missing fields and operators can patch the input
 * through `inputOverrides` in the provider configuration.
 */
export interface ActorAdapter {
  readonly key: string;
  readonly platform: Platform;
  readonly purposes: AdapterPurpose[];
  readonly defaultActorId: string;
  readonly description: string;
  buildDiscoveryInput?(criteria: SearchCriteria, settings: AdapterSettings): unknown;
  buildProfileInput?(targets: ProfileTarget[], settings: AdapterSettings): unknown;
  buildContentInput?(criteria: ContentCriteria, settings: AdapterSettings): unknown;
  normalizeProfiles(items: Item[], source: DiscoverySource): DiscoveryResult[];
  normalizeContent?(items: Item[], source: DiscoverySource): ContentResult[];
}

function applyOverrides(input: Record<string, unknown>, settings: AdapterSettings): Record<string, unknown> {
  return settings.inputOverrides ? { ...input, ...settings.inputOverrides } : input;
}

function searchPhrase(criteria: SearchCriteria): string {
  const kw = criteria.keywords.slice(0, 3).join(" ");
  const loc = locationText(criteria.location);
  return [kw, loc].filter(Boolean).join(" ").trim();
}

// ---------------------------------------------------------------------------
// Instagram: keyword/user search (apify/instagram-scraper)
// ---------------------------------------------------------------------------

export const instagramSearchAdapter: ActorAdapter = {
  key: "instagram-search",
  platform: "INSTAGRAM",
  purposes: ["DISCOVERY", "PROFILE", "CONTENT"],
  defaultActorId: "apify/instagram-scraper",
  description: "Instagram user search + profile details via apify/instagram-scraper",
  buildDiscoveryInput(criteria, settings) {
    return applyOverrides(
      {
        search: searchPhrase(criteria),
        searchType: "user",
        searchLimit: Math.min(Math.max(criteria.limit * 2, 10), 100),
        resultsType: "details",
        resultsLimit: 1,
        addParentData: false,
      },
      settings,
    );
  },
  buildProfileInput(targets, settings) {
    return applyOverrides(
      {
        directUrls: targets.map((t) => t.profileUrl),
        resultsType: "details",
        resultsLimit: 1,
        addParentData: false,
      },
      settings,
    );
  },
  buildContentInput(criteria, settings) {
    return applyOverrides(
      {
        search: criteria.hashtags[0] ?? criteria.keywords.join(" "),
        searchType: criteria.hashtags.length ? "hashtag" : "user",
        searchLimit: 5,
        resultsType: "posts",
        resultsLimit: Math.min(criteria.limit, 200),
        addParentData: false,
      },
      settings,
    );
  },
  normalizeProfiles(items, source) {
    return items
      .map((item, index) => normalizeInstagramProfile(item, { source, providerScore: 1 - Math.min(index, 99) / 100 }))
      .filter((r): r is DiscoveryResult => Boolean(r));
  },
  normalizeContent(items, source) {
    return items.map((item) => normalizeInstagramPost(item, source)).filter((r): r is ContentResult => Boolean(r));
  },
};

// ---------------------------------------------------------------------------
// Instagram: profile details for known usernames (apify/instagram-profile-scraper)
// ---------------------------------------------------------------------------

export const instagramProfileAdapter: ActorAdapter = {
  key: "instagram-profile",
  platform: "INSTAGRAM",
  purposes: ["PROFILE"],
  defaultActorId: "apify/instagram-profile-scraper",
  description: "Full profile details (bio, followers, website, business contact) for known usernames",
  buildProfileInput(targets, settings) {
    const usernames = targets.map((t) => t.username ?? parseSocialUrl(t.profileUrl)?.username).filter((u): u is string => Boolean(u));
    return applyOverrides({ usernames }, settings);
  },
  normalizeProfiles(items, source) {
    return items.map((item) => normalizeInstagramProfile(item, { source })).filter((r): r is DiscoveryResult => Boolean(r));
  },
};

// ---------------------------------------------------------------------------
// Instagram: hashtag posts (apify/instagram-hashtag-scraper)
// ---------------------------------------------------------------------------

export function normalizeInstagramPost(item: Item, source: DiscoverySource): ContentResult | null {
  const url = pickString(item, ["url", "postUrl", "link"]);
  const owner = normalizeUsername(pickString(item, ["ownerUsername", "owner.username", "username"]));
  const caption = pickString(item, ["caption", "text", "description"]);
  const hashtagsRaw = item.hashtags;
  const hashtags = Array.isArray(hashtagsRaw)
    ? hashtagsRaw.filter((h): h is string => typeof h === "string").map((h) => h.replace(/^#/, "").toLowerCase())
    : (caption?.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((h) => h.slice(1).toLowerCase());
  if (!url && !owner && !caption) return null;
  return {
    platform: "INSTAGRAM",
    accountUsername: owner,
    accountName: pickString(item, ["ownerFullName", "owner.full_name", "fullName"]),
    accountUrl: owner ? `https://www.instagram.com/${owner}/` : null,
    postUrl: url,
    externalId: pickString(item, ["id", "shortCode", "shortcode", "pk"]),
    postedAt: pickDate(item, ["timestamp", "takenAt", "taken_at", "takenAtTimestamp"]),
    caption,
    hashtags: [...new Set(hashtags)],
    likes: pickNumber(item, ["likesCount", "likes", "like_count"]),
    comments: pickNumber(item, ["commentsCount", "comments", "comment_count"]),
    views: pickNumber(item, ["videoViewCount", "videoPlayCount", "views", "view_count"]),
    mediaType: pickString(item, ["type", "productType", "mediaType"]),
    location: pickString(item, ["locationName", "location.name", "location"]),
    raw: item,
    source,
  };
}

export const instagramHashtagAdapter: ActorAdapter = {
  key: "instagram-hashtag",
  platform: "INSTAGRAM",
  purposes: ["CONTENT", "DISCOVERY"],
  defaultActorId: "apify/instagram-hashtag-scraper",
  description: "Recent posts for hashtags; post authors become discovery candidates",
  buildDiscoveryInput(criteria, settings) {
    return applyOverrides({ hashtags: criteria.hashtags.slice(0, 3), resultsLimit: Math.min(criteria.limit * 3, 150) }, settings);
  },
  buildContentInput(criteria, settings) {
    return applyOverrides({ hashtags: criteria.hashtags.length ? criteria.hashtags.slice(0, 5) : criteria.keywords.slice(0, 3).map((k) => k.replace(/\s+/g, "")), resultsLimit: Math.min(criteria.limit, 300) }, settings);
  },
  normalizeProfiles(items, source) {
    // Post authors -> candidate accounts (deduplicated by username); followers unknown until profile enrichment.
    const seen = new Map<string, DiscoveryResult>();
    for (const item of items) {
      const post = normalizeInstagramPost(item, source);
      if (!post?.accountUsername || seen.has(post.accountUsername)) continue;
      seen.set(post.accountUsername, {
        platform: "INSTAGRAM",
        username: post.accountUsername,
        profileUrl: `https://www.instagram.com/${post.accountUsername}/`,
        externalId: pickString(item, ["ownerId", "owner.id"]),
        displayName: post.accountName,
        bio: null,
        lastPostAt: post.postedAt,
        location: post.location ? { address: post.location } : null,
        providerScore: 0.5,
        raw: item,
        source,
      });
    }
    return [...seen.values()];
  },
  normalizeContent(items, source) {
    return items.map((item) => normalizeInstagramPost(item, source)).filter((r): r is ContentResult => Boolean(r));
  },
};

// ---------------------------------------------------------------------------
// Facebook: page details (apify/facebook-pages-scraper) and page search
// ---------------------------------------------------------------------------

export const facebookPagesAdapter: ActorAdapter = {
  key: "facebook-pages",
  platform: "FACEBOOK",
  purposes: ["PROFILE"],
  defaultActorId: "apify/facebook-pages-scraper",
  description: "Public Facebook Page details (about, contact, website, followers) for known page URLs",
  buildProfileInput(targets, settings) {
    return applyOverrides({ startUrls: targets.map((t) => ({ url: t.profileUrl })) }, settings);
  },
  normalizeProfiles(items, source) {
    return items.map((item) => normalizeFacebookPage(item, { source })).filter((r): r is DiscoveryResult => Boolean(r));
  },
};

export const facebookSearchAdapter: ActorAdapter = {
  key: "facebook-search",
  platform: "FACEBOOK",
  purposes: ["DISCOVERY"],
  defaultActorId: "apify/facebook-search-scraper",
  description: "Facebook page search by keyword (verify the Actor input schema for your account)",
  buildDiscoveryInput(criteria, settings) {
    return applyOverrides({ searchQueries: [searchPhrase(criteria)], searchType: "pages", resultsLimit: Math.min(criteria.limit * 2, 100) }, settings);
  },
  normalizeProfiles(items, source) {
    return items.map((item, index) => normalizeFacebookPage(item, { source, providerScore: 1 - Math.min(index, 99) / 100 })).filter((r): r is DiscoveryResult => Boolean(r));
  },
};

// ---------------------------------------------------------------------------
// Search engine strategy (apify/google-search-scraper): site:instagram.com / site:facebook.com
// ---------------------------------------------------------------------------

export function buildSearchEngineQueries(criteria: SearchCriteria, platform: Platform, maxQueries = 3): string[] {
  const site = platform === "INSTAGRAM" ? "site:instagram.com" : "site:facebook.com";
  const loc = [criteria.location.city, criteria.location.region, criteria.location.country].filter(Boolean) as string[];
  const locPart = loc.length ? loc.map((l) => `"${l}"`).join(" ") : "";
  const groups: string[] = [];
  const keywords = criteria.keywords.length ? criteria.keywords : ["apparel brand"];
  for (const kw of keywords.slice(0, maxQueries)) {
    groups.push(`${site} "${kw}" ${locPart} -inurl:/p/ -inurl:/reel/ -inurl:/explore/`.replace(/\s+/g, " ").trim());
  }
  if (criteria.category && !keywords.includes(criteria.category) && groups.length < maxQueries) {
    groups.push(`${site} "${criteria.category}" ${locPart}`.replace(/\s+/g, " ").trim());
  }
  return [...new Set(groups)];
}

function parseSearchSnippet(title: string | null, description: string | null): { displayName: string | null; followers: number | null; bio: string | null; username: string | null } {
  let displayName: string | null = null;
  let username: string | null = null;
  if (title) {
    const m = /^(.*?)\s*\(@([A-Za-z0-9._]+)\)/.exec(title);
    if (m) {
      displayName = (m[1] ?? "").trim() || null;
      username = normalizeUsername(m[2]);
    } else {
      displayName = title.replace(/\s*[|•\-–]\s*(Instagram|Facebook).*$/i, "").trim() || null;
    }
  }
  let followers: number | null = null;
  let bio: string | null = description;
  if (description) {
    const f = /([\d.,]+\s?[KkMm]?)\s+Followers/.exec(description);
    if (f) followers = parseCompactNumber((f[1] ?? "").replace(/\s/g, ""));
    bio = description.replace(/^.*?Posts\s*[-–•]\s*/i, "").replace(/^See Instagram photos and videos from\s*/i, "").trim() || null;
  }
  return { displayName, followers, bio, username };
}

export function normalizeSearchEngineItems(items: Item[], platform: Platform, source: DiscoverySource): DiscoveryResult[] {
  const out = new Map<string, DiscoveryResult>();
  for (const item of items) {
    const organic = Array.isArray(item.organicResults) ? (item.organicResults as Item[]) : Array.isArray(item.results) ? (item.results as Item[]) : [item];
    for (const r of organic) {
      const url = pickString(r, ["url", "link"]);
      const parsed = url ? parseSocialUrl(url) : null;
      if (!parsed || parsed.platform !== platform) continue;
      const snippet = parseSearchSnippet(pickString(r, ["title"]), pickString(r, ["description", "snippet"]));
      const username = parsed.username ?? snippet.username;
      const key = username ?? parsed.externalId ?? parsed.profileUrl;
      if (!key || out.has(key)) continue;
      const position = pickNumber(r, ["position", "rank"]) ?? out.size + 1;
      out.set(key, {
        platform,
        username,
        profileUrl: parsed.profileUrl,
        externalId: parsed.externalId,
        displayName: snippet.displayName,
        followers: snippet.followers,
        bio: snippet.bio,
        providerScore: Math.max(0, 1 - position / 100),
        raw: r,
        source,
      });
    }
  }
  return [...out.values()];
}

export function createSearchEngineAdapter(platform: Platform): ActorAdapter {
  return {
    key: platform === "INSTAGRAM" ? "search-engine-instagram" : "search-engine-facebook",
    platform,
    purposes: ["DISCOVERY"],
    defaultActorId: "apify/google-search-scraper",
    description: `Google results restricted to ${platform === "INSTAGRAM" ? "instagram.com" : "facebook.com"} for keyword + location queries`,
    buildDiscoveryInput(criteria, settings) {
      const queries = buildSearchEngineQueries(criteria, platform);
      return applyOverrides(
        {
          queries: queries.join("\n"),
          resultsPerPage: Math.min(100, Math.max(20, criteria.limit * 2)),
          maxPagesPerQuery: 1,
          languageCode: "en",
          mobileResults: false,
          ...(settings.countryCode ? { countryCode: settings.countryCode } : criteria.location.countryCode ? { countryCode: criteria.location.countryCode.toLowerCase() } : {}),
        },
        settings,
      );
    },
    normalizeProfiles(items, source) {
      return normalizeSearchEngineItems(items, platform, source);
    },
  };
}

// ---------------------------------------------------------------------------
// Generic adapter: operator-supplied input template, platform-based normalization
// ---------------------------------------------------------------------------

function fillTemplate(value: unknown, vars: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    const exact = /^\{\{(\w+)\}\}$/.exec(value.trim());
    if (exact && exact[1] && exact[1] in vars) return vars[exact[1]];
    return value.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => {
      const v = vars[k];
      return Array.isArray(v) ? v.join(" ") : v == null ? "" : String(v);
    });
  }
  if (Array.isArray(value)) return value.map((v) => fillTemplate(v, vars));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, fillTemplate(v, vars)]));
  }
  return value;
}

export function createGenericAdapter(platform: Platform, actorId: string): ActorAdapter {
  return {
    key: "generic",
    platform,
    purposes: ["DISCOVERY", "PROFILE", "CONTENT"],
    defaultActorId: actorId,
    description: "Custom Actor with an operator-defined input template ({{query}}, {{keywords}}, {{location}}, {{limit}}, {{hashtags}}, {{urls}}, {{usernames}})",
    buildDiscoveryInput(criteria, settings) {
      const template = (settings.inputTemplate as Record<string, unknown> | undefined) ?? { search: "{{query}}", maxResults: "{{limit}}" };
      return fillTemplate(template, { query: searchPhrase(criteria), keywords: criteria.keywords, location: locationText(criteria.location), limit: criteria.limit, hashtags: criteria.hashtags, city: criteria.location.city, country: criteria.location.country });
    },
    buildProfileInput(targets, settings) {
      const template = (settings.profileInputTemplate as Record<string, unknown> | undefined) ?? { startUrls: "{{urls}}" };
      const urls = targets.map((t) => ({ url: t.profileUrl }));
      return fillTemplate(template, { urls, usernames: targets.map((t) => t.username).filter(Boolean), limit: targets.length });
    },
    buildContentInput(criteria, settings) {
      const template = (settings.contentInputTemplate as Record<string, unknown> | undefined) ?? { hashtags: "{{hashtags}}", resultsLimit: "{{limit}}" };
      return fillTemplate(template, { keywords: criteria.keywords, hashtags: criteria.hashtags, limit: criteria.limit, location: locationText(criteria.location) });
    },
    normalizeProfiles(items, source) {
      const fn = platform === "INSTAGRAM" ? normalizeInstagramProfile : normalizeFacebookPage;
      return items.map((item) => fn(item, { source })).filter((r): r is DiscoveryResult => Boolean(r));
    },
    normalizeContent(items, source) {
      return items.map((item) => normalizeInstagramPost(item, source)).filter((r): r is ContentResult => Boolean(r));
    },
  };
}

export const BUILT_IN_ADAPTERS: Record<string, ActorAdapter> = {
  [instagramSearchAdapter.key]: instagramSearchAdapter,
  [instagramProfileAdapter.key]: instagramProfileAdapter,
  [instagramHashtagAdapter.key]: instagramHashtagAdapter,
  [facebookPagesAdapter.key]: facebookPagesAdapter,
  [facebookSearchAdapter.key]: facebookSearchAdapter,
  "search-engine-instagram": createSearchEngineAdapter("INSTAGRAM"),
  "search-engine-facebook": createSearchEngineAdapter("FACEBOOK"),
};

export function resolveAdapter(key: string, platform: Platform, actorId: string): ActorAdapter {
  const found = BUILT_IN_ADAPTERS[key];
  if (found) return found;
  if (key === "generic") return createGenericAdapter(platform, actorId);
  throw new Error(`Unknown actor adapter: ${key}`);
}
