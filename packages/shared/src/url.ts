/** URL helpers for social profiles and websites. */

export type SocialPlatform = "INSTAGRAM" | "FACEBOOK";

const IG_RESERVED = new Set(["p", "reel", "reels", "explore", "accounts", "direct", "stories", "tv", "about", "developer", "legal", "s", "web"]);
const FB_RESERVED = new Set(["pages", "groups", "events", "marketplace", "watch", "gaming", "profile.php", "people", "public", "photo", "photo.php", "login", "help", "policies", "privacy", "share", "sharer", "sharer.php", "hashtag", "search", "story.php", "permalink.php", "posts", "videos", "reel"]);

export function normalizeUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  let raw = input.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw.replace(/^\/+/, "");
  try {
    const u = new URL(raw);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    // strip tracking params
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|igsh|igshid|ref$|hl$)/i.test(key)) u.searchParams.delete(key);
    }
    let s = u.toString();
    if (s.endsWith("/") && u.pathname === "/") s = s.slice(0, -1);
    return s;
  } catch {
    return null;
  }
}

/** Registrable-ish domain: lowercase host without leading www. */
export function extractDomain(input: string | null | undefined): string | null {
  const n = normalizeUrl(input);
  if (!n) return null;
  try {
    const host = new URL(n).hostname.replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

export function isSocialDomain(domain: string | null | undefined): boolean {
  if (!domain) return false;
  return /(^|\.)(instagram\.com|facebook\.com|fb\.com|fb\.me|linktr\.ee|linkin\.bio|beacons\.ai|twitter\.com|x\.com|tiktok\.com|youtube\.com|youtu\.be|pinterest\.com|threads\.net|wa\.me|whatsapp\.com|t\.me|snapchat\.com|linkedin\.com)$/i.test(domain);
}

export function isLinkAggregatorDomain(domain: string | null | undefined): boolean {
  if (!domain) return false;
  return /(^|\.)(linktr\.ee|linkin\.bio|beacons\.ai|bio\.site|bio\.link|lnk\.bio|campsite\.bio|tap\.bio|milkshake\.app|solo\.to|carrd\.co|stan\.store)$/i.test(domain);
}

export function normalizeUsername(input: string | null | undefined): string | null {
  if (!input) return null;
  const u = input.trim().replace(/^@/, "").toLowerCase();
  if (!u || !/^[a-z0-9._-]{1,64}$/.test(u)) return null;
  return u;
}

export interface ParsedSocialUrl {
  platform: SocialPlatform;
  username: string | null;
  profileUrl: string;
  /** Facebook numeric page/profile id when the URL uses profile.php?id= */
  externalId: string | null;
}

export function parseSocialUrl(input: string | null | undefined): ParsedSocialUrl | null {
  const n = normalizeUrl(input);
  if (!n) return null;
  let u: URL;
  try {
    u = new URL(n);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m|l|web|business|mobile)\./, "");
  const segments = u.pathname.split("/").filter(Boolean);
  if (host === "instagram.com" || host === "instagr.am") {
    const first = segments[0];
    if (!first || IG_RESERVED.has(first.toLowerCase())) return null;
    const username = normalizeUsername(first);
    if (!username) return null;
    return { platform: "INSTAGRAM", username, profileUrl: `https://www.instagram.com/${username}/`, externalId: null };
  }
  if (host === "facebook.com" || host === "fb.com" || host === "fb.me") {
    const first = segments[0];
    if (!first) return null;
    if (first === "profile.php") {
      const id = u.searchParams.get("id");
      if (!id || !/^\d+$/.test(id)) return null;
      return { platform: "FACEBOOK", username: null, profileUrl: `https://www.facebook.com/profile.php?id=${id}`, externalId: id };
    }
    if (first === "pages" || first === "pg") {
      const last = segments[segments.length - 1];
      if (last && /^\d+$/.test(last)) {
        return { platform: "FACEBOOK", username: null, profileUrl: `https://www.facebook.com/${last}`, externalId: last };
      }
      const uname = normalizeUsername(segments[1]);
      if (!uname) return null;
      return { platform: "FACEBOOK", username: uname, profileUrl: `https://www.facebook.com/${uname}`, externalId: null };
    }
    if (FB_RESERVED.has(first.toLowerCase())) return null;
    if (/^\d+$/.test(first)) {
      return { platform: "FACEBOOK", username: null, profileUrl: `https://www.facebook.com/${first}`, externalId: first };
    }
    const username = normalizeUsername(first);
    if (!username) return null;
    return { platform: "FACEBOOK", username, profileUrl: `https://www.facebook.com/${username}`, externalId: null };
  }
  return null;
}

export function buildProfileUrl(platform: SocialPlatform, username: string): string {
  const u = normalizeUsername(username) ?? username;
  return platform === "INSTAGRAM" ? `https://www.instagram.com/${u}/` : `https://www.facebook.com/${u}`;
}

/** Public "open conversation" URL. Navigation target only; it never implies permission to message. */
export function buildInboxUrl(
  platform: SocialPlatform,
  opts: { username?: string | null; externalThreadId?: string | null; externalId?: string | null },
): string | null {
  if (platform === "INSTAGRAM") {
    if (opts.externalThreadId) return `https://www.instagram.com/direct/t/${opts.externalThreadId}/`;
    return "https://www.instagram.com/direct/new/";
  }
  if (opts.externalThreadId) return `https://www.facebook.com/messages/t/${opts.externalThreadId}`;
  if (opts.externalId) return `https://www.facebook.com/messages/t/${opts.externalId}`;
  return null;
}

/** Extract all http(s) URLs from free text (bios, captions). */
export function extractUrls(text: string | null | undefined): string[] {
  if (!text) return [];
  const out = new Set<string>();
  const re = /\b((?:https?:\/\/|www\.)[^\s<>"')\]]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const n = normalizeUrl(m[1]);
    if (n) out.add(n);
  }
  return [...out];
}
