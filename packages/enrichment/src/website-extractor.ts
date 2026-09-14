import {
  assertPublicHttpUrl,
  createLogger,
  extractDomain,
  extractEmails,
  extractPhones,
  extractWhatsAppNumbers,
  fetchWithTimeout,
  isPlaceholderEmail,
  normalizeEmail,
  normalizePhone,
  normalizeUrl,
  parseSocialUrl,
  readTextCapped,
  type Platform,
} from "@oses/shared";

const log = createLogger("enrichment.website");

export interface ExtractedContact {
  type: "EMAIL" | "PHONE" | "WHATSAPP" | "ADDRESS";
  value: string;
  normalizedValue: string;
  sourceUrl: string;
  /** VERIFIED when it comes from structured data / mailto on the brand's own domain, otherwise PUBLIC. */
  confidence: "VERIFIED" | "PUBLIC";
  label?: string | null;
}

export interface WebsiteExtraction {
  url: string;
  finalUrl: string;
  domain: string | null;
  siteName: string | null;
  title: string | null;
  description: string | null;
  contacts: ExtractedContact[];
  socialLinks: Array<{ platform: Platform; username: string | null; profileUrl: string; externalId: string | null }>;
  pagesFetched: string[];
  warnings: string[];
}

const USER_AGENT = "Mozilla/5.0 (compatible; OSES-J/1.0; +https://oses-j.local/bot) contact-discovery";

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#64;/g, "@")
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']+)["']`, "i");
  const alt = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${name}["']`, "i");
  const m = re.exec(html) ?? alt.exec(html);
  return m?.[1]?.trim() || null;
}

function extractHrefs(html: string, base: string): string[] {
  const out = new Set<string>();
  const re = /href\s*=\s*["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = (m[1] ?? "").trim();
    if (!raw || raw.startsWith("javascript:")) continue;
    if (raw.startsWith("mailto:") || raw.startsWith("tel:")) {
      out.add(raw);
      continue;
    }
    try {
      out.add(new URL(raw, base).toString());
    } catch {
      /* ignore malformed */
    }
  }
  return [...out];
}

function extractJsonLd(html: string): Array<Record<string, unknown>> {
  const blocks: Array<Record<string, unknown>> = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse((m[1] ?? "").trim()) as unknown;
      const list = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of list) {
        if (item && typeof item === "object") {
          const graph = (item as Record<string, unknown>)["@graph"];
          if (Array.isArray(graph)) for (const g of graph) if (g && typeof g === "object") blocks.push(g as Record<string, unknown>);
          blocks.push(item as Record<string, unknown>);
        }
      }
    } catch {
      /* invalid JSON-LD is common; ignore */
    }
  }
  return blocks;
}

async function fetchPage(url: string): Promise<{ html: string; finalUrl: string } | null> {
  try {
    await assertPublicHttpUrl(url);
    const res = await fetchWithTimeout(url, {
      timeoutMs: 12_000,
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml", "Accept-Language": "en" },
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml/i.test(type)) return null;
    // Redirect target must also be public.
    await assertPublicHttpUrl(res.url || url);
    const html = await readTextCapped(res, 1_500_000);
    return { html, finalUrl: res.url || url };
  } catch (err) {
    log.debug("page fetch failed", { url, error: (err as Error).message });
    return null;
  }
}

const CONTACT_PATH_RE = /\/(contact|contact-us|contactus|about|about-us|wholesale|b2b|impressum|kontakt|support|pages\/contact|pages\/about|pages\/wholesale)\/?$/i;

/**
 * Fetch a business website (home + one contact/about page) and extract public contact details.
 * The extractor only reads publicly served HTML, never logs in, and stops after a small byte budget.
 */
export async function extractWebsite(inputUrl: string): Promise<WebsiteExtraction> {
  const url = normalizeUrl(inputUrl);
  const warnings: string[] = [];
  const result: WebsiteExtraction = { url: inputUrl, finalUrl: inputUrl, domain: extractDomain(inputUrl), siteName: null, title: null, description: null, contacts: [], socialLinks: [], pagesFetched: [], warnings };
  if (!url) {
    warnings.push("Invalid website URL");
    return result;
  }
  const home = await fetchPage(url);
  if (!home) {
    warnings.push("Website could not be fetched (unreachable, blocked, or not HTML)");
    return result;
  }
  result.finalUrl = home.finalUrl;
  result.domain = extractDomain(home.finalUrl);
  result.pagesFetched.push(home.finalUrl);
  const pages: Array<{ html: string; finalUrl: string }> = [home];
  const hrefs = extractHrefs(home.html, home.finalUrl);
  const contactLink = hrefs.find((h) => {
    try {
      const u = new URL(h);
      return extractDomain(u.toString()) === result.domain && CONTACT_PATH_RE.test(u.pathname);
    } catch {
      return false;
    }
  });
  if (contactLink) {
    const page = await fetchPage(contactLink);
    if (page) {
      pages.push(page);
      result.pagesFetched.push(page.finalUrl);
    }
  }

  const titleMatch = /<title[^>]*>([^<]{1,200})<\/title>/i.exec(home.html);
  result.title = titleMatch?.[1]?.trim() || null;
  result.siteName = metaContent(home.html, "og:site_name") ?? null;
  result.description = metaContent(home.html, "description") ?? metaContent(home.html, "og:description") ?? null;

  const seen = new Set<string>();
  const addContact = (c: ExtractedContact) => {
    const key = `${c.type}:${c.normalizedValue}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.contacts.push(c);
  };
  const ownDomain = result.domain;

  for (const page of pages) {
    const pageHrefs = extractHrefs(page.html, page.finalUrl);
    // Structured data first (highest confidence).
    for (const block of extractJsonLd(page.html)) {
      const type = String(block["@type"] ?? "");
      if (!/Organization|LocalBusiness|Store|Corporation|ClothingStore|Brand/i.test(type)) continue;
      const email = normalizeEmail(typeof block.email === "string" ? block.email : null);
      if (email && !isPlaceholderEmail(email)) addContact({ type: "EMAIL", value: email, normalizedValue: email, sourceUrl: page.finalUrl, confidence: "VERIFIED", label: "structured-data" });
      const phone = normalizePhone(typeof block.telephone === "string" ? block.telephone : null);
      if (phone) addContact({ type: "PHONE", value: String(block.telephone), normalizedValue: phone, sourceUrl: page.finalUrl, confidence: "VERIFIED", label: "structured-data" });
      const address = block.address;
      if (address && typeof address === "object") {
        const a = address as Record<string, unknown>;
        const text = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, a.addressCountry].filter((x) => typeof x === "string" && x).join(", ");
        if (text) addContact({ type: "ADDRESS", value: text, normalizedValue: text.toLowerCase().slice(0, 191), sourceUrl: page.finalUrl, confidence: "VERIFIED", label: "structured-data" });
      } else if (typeof address === "string" && address.trim()) {
        addContact({ type: "ADDRESS", value: address.trim(), normalizedValue: address.trim().toLowerCase().slice(0, 191), sourceUrl: page.finalUrl, confidence: "VERIFIED", label: "structured-data" });
      }
      const sameAs = Array.isArray(block.sameAs) ? block.sameAs : typeof block.sameAs === "string" ? [block.sameAs] : [];
      for (const s of sameAs) if (typeof s === "string") pageHrefs.push(s);
      if (!result.siteName && typeof block.name === "string") result.siteName = block.name;
    }
    // mailto / tel / wa.me links
    for (const href of pageHrefs) {
      if (href.startsWith("mailto:")) {
        const e = normalizeEmail(href);
        if (e && !isPlaceholderEmail(e)) {
          const own = ownDomain ? e.endsWith("@" + ownDomain) || e.endsWith("." + ownDomain) : false;
          addContact({ type: "EMAIL", value: e, normalizedValue: e, sourceUrl: page.finalUrl, confidence: own ? "VERIFIED" : "PUBLIC", label: "mailto" });
        }
      } else if (href.startsWith("tel:")) {
        const p = normalizePhone(decodeURIComponent(href.slice(4)));
        if (p) addContact({ type: "PHONE", value: href.slice(4), normalizedValue: p, sourceUrl: page.finalUrl, confidence: "VERIFIED", label: "tel-link" });
      } else {
        for (const w of extractWhatsAppNumbers(href)) addContact({ type: "WHATSAPP", value: w, normalizedValue: w, sourceUrl: page.finalUrl, confidence: "VERIFIED", label: "whatsapp-link" });
        const social = parseSocialUrl(href);
        if (social && !result.socialLinks.some((s) => s.profileUrl === social.profileUrl)) result.socialLinks.push(social);
      }
    }
    // Visible text (lower confidence).
    const text = stripTags(page.html);
    for (const e of extractEmails(text)) {
      const own = ownDomain ? e.endsWith("@" + ownDomain) : false;
      addContact({ type: "EMAIL", value: e, normalizedValue: e, sourceUrl: page.finalUrl, confidence: own ? "VERIFIED" : "PUBLIC", label: "page-text" });
    }
    for (const w of extractWhatsAppNumbers(text)) addContact({ type: "WHATSAPP", value: w, normalizedValue: w, sourceUrl: page.finalUrl, confidence: "PUBLIC", label: "page-text" });
    if (!result.contacts.some((c) => c.type === "PHONE")) {
      for (const p of extractPhones(text).slice(0, 2)) addContact({ type: "PHONE", value: p, normalizedValue: p, sourceUrl: page.finalUrl, confidence: "PUBLIC", label: "page-text" });
    }
  }
  log.info("website extracted", { domain: result.domain, contacts: result.contacts.length, social: result.socialLinks.length, pages: result.pagesFetched.length });
  return result;
}
