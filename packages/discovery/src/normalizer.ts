import {
  buildInboxUrl,
  extractDomain,
  extractEmails,
  extractPhones,
  extractUrls,
  extractWhatsAppNumbers,
  isLinkAggregatorDomain,
  isPlaceholderEmail,
  isSocialDomain,
  normalizeEmail,
  normalizePhone,
  normalizeUrl,
  parseSocialUrl,
  type Platform,
} from "@oses/shared";
import type { DiscoveryResult, DiscoverySource } from "./types";

export type ContactTypeValue = "EMAIL" | "PHONE" | "WHATSAPP" | "WEBSITE" | "ADDRESS";
export type ContactSourceValue = "PROFILE" | "WEBSITE" | "FACEBOOK_PAGE" | "INSTAGRAM_BIO" | "SEARCH_ENGINE" | "MANUAL" | "AI_INFERRED";
export type ContactConfidenceValue = "VERIFIED" | "PUBLIC" | "INFERRED";

export interface NormalizedContact {
  type: ContactTypeValue;
  value: string;
  normalizedValue: string;
  source: ContactSourceValue;
  sourceUrl?: string | null;
  confidence: ContactConfidenceValue;
  label?: string | null;
}

/** Lead shape ready to be persisted (Lead + LeadSocialAccount + LeadContact rows). */
export interface NormalizedLead {
  dedupeKey: string;
  brandName: string;
  name: string | null;
  platform: Platform;
  username: string | null;
  profileUrl: string;
  inboxUrl: string | null;
  externalId: string | null;
  followers: number | null;
  following: number | null;
  postsCount: number | null;
  bio: string | null;
  website: string | null;
  websiteDomain: string | null;
  websiteIsAggregator: boolean;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  address: string | null;
  category: string | null;
  isBusiness: boolean | null;
  isVerified: boolean | null;
  isPrivate: boolean | null;
  lastPostAt: Date | null;
  /** Other social profiles referenced by this account (e.g. a Facebook link in an Instagram bio). */
  socialLinks: Array<{ platform: Platform; username: string | null; profileUrl: string; externalId: string | null }>;
  links: string[];
  contacts: NormalizedContact[];
  source: DiscoverySource;
  providerScore: number | null;
  raw: unknown;
}

export function makeDedupeKey(platform: Platform, username: string | null, externalId: string | null | undefined, profileUrl: string): string {
  const p = platform === "INSTAGRAM" ? "ig" : "fb";
  if (username) return `${p}:${username}`;
  if (externalId) return `${p}:id:${externalId}`;
  return `${p}:url:${profileUrl.toLowerCase()}`;
}

function contactSourceFor(platform: Platform, fromBio: boolean): ContactSourceValue {
  if (fromBio) return platform === "INSTAGRAM" ? "INSTAGRAM_BIO" : "FACEBOOK_PAGE";
  return platform === "INSTAGRAM" ? "PROFILE" : "FACEBOOK_PAGE";
}

/**
 * Turn a provider result into the persisted lead shape.
 * Rules: never invent data, label every contact with where it came from, and keep raw output attached.
 */
export function normalizeDiscoveryResult(result: DiscoveryResult): NormalizedLead {
  const platform = result.platform;
  const username = result.username;
  const displayName = result.displayName?.trim() || null;
  const brandName = displayName || username || result.profileUrl;
  const bio = result.bio?.trim() || null;
  const contacts: NormalizedContact[] = [];
  const socialLinks: NormalizedLead["socialLinks"] = [];
  const links = new Set<string>();

  // --- website & links ---
  let website: string | null = null;
  let websiteDomain: string | null = null;
  let websiteIsAggregator = false;
  const candidateLinks = [...(result.website ? [result.website] : []), ...(result.links ?? []), ...extractUrls(bio)];
  for (const raw of candidateLinks) {
    const url = normalizeUrl(raw);
    if (!url) continue;
    const domain = extractDomain(url);
    if (!domain) continue;
    const social = parseSocialUrl(url);
    if (social && !(social.platform === platform && social.username === username)) {
      socialLinks.push({ platform: social.platform, username: social.username, profileUrl: social.profileUrl, externalId: social.externalId });
      continue;
    }
    if (isSocialDomain(domain) && !isLinkAggregatorDomain(domain)) {
      links.add(url);
      continue;
    }
    links.add(url);
    if (!website || (websiteIsAggregator && !isLinkAggregatorDomain(domain))) {
      website = url;
      websiteDomain = domain;
      websiteIsAggregator = isLinkAggregatorDomain(domain);
    }
  }
  if (website) {
    contacts.push({ type: "WEBSITE", value: website, normalizedValue: websiteDomain ?? website, source: contactSourceFor(platform, false), sourceUrl: result.profileUrl, confidence: "PUBLIC", label: websiteIsAggregator ? "link-in-bio" : null });
  }

  // --- email ---
  let email: string | null = null;
  const profileEmail = normalizeEmail(result.email);
  if (profileEmail && !isPlaceholderEmail(profileEmail)) {
    email = profileEmail;
    contacts.push({ type: "EMAIL", value: profileEmail, normalizedValue: profileEmail, source: contactSourceFor(platform, false), sourceUrl: result.profileUrl, confidence: "PUBLIC" });
  }
  for (const e of extractEmails(bio)) {
    if (contacts.some((c) => c.type === "EMAIL" && c.normalizedValue === e)) continue;
    if (!email) email = e;
    contacts.push({ type: "EMAIL", value: e, normalizedValue: e, source: contactSourceFor(platform, true), sourceUrl: result.profileUrl, confidence: "PUBLIC" });
  }

  // --- whatsapp & phone ---
  let whatsapp: string | null = null;
  for (const w of extractWhatsAppNumbers([bio ?? "", ...links].join(" "))) {
    if (!whatsapp) whatsapp = w;
    contacts.push({ type: "WHATSAPP", value: w, normalizedValue: w, source: contactSourceFor(platform, true), sourceUrl: result.profileUrl, confidence: "PUBLIC" });
  }
  let phone: string | null = null;
  const profilePhone = normalizePhone(result.phone);
  if (profilePhone) {
    phone = profilePhone;
    contacts.push({ type: "PHONE", value: profilePhone, normalizedValue: profilePhone, source: contactSourceFor(platform, false), sourceUrl: result.profileUrl, confidence: "PUBLIC" });
  }
  for (const p of extractPhones(bio)) {
    if (contacts.some((c) => (c.type === "PHONE" || c.type === "WHATSAPP") && c.normalizedValue === p)) continue;
    if (!phone) phone = p;
    contacts.push({ type: "PHONE", value: p, normalizedValue: p, source: contactSourceFor(platform, true), sourceUrl: result.profileUrl, confidence: "PUBLIC" });
  }

  // --- location (only when the provider returned it) ---
  const loc = result.location ?? null;
  const address = loc?.address?.trim() || null;
  if (address) {
    contacts.push({ type: "ADDRESS", value: address, normalizedValue: address.toLowerCase().slice(0, 191), source: contactSourceFor(platform, false), sourceUrl: result.profileUrl, confidence: "PUBLIC" });
  }

  const externalId = result.externalId ?? null;
  return {
    dedupeKey: makeDedupeKey(platform, username, externalId, result.profileUrl),
    brandName: brandName.slice(0, 191),
    name: displayName,
    platform,
    username,
    profileUrl: result.profileUrl,
    inboxUrl: buildInboxUrl(platform, { username, externalId }),
    externalId,
    followers: result.followers ?? null,
    following: result.following ?? null,
    postsCount: result.postsCount ?? null,
    bio,
    website,
    websiteDomain,
    websiteIsAggregator,
    email,
    phone,
    whatsapp,
    country: loc?.country?.trim() || null,
    region: loc?.region?.trim() || null,
    city: loc?.city?.trim() || null,
    address,
    category: result.category?.trim() || null,
    isBusiness: result.isBusiness ?? null,
    isVerified: result.isVerified ?? null,
    isPrivate: result.isPrivate ?? null,
    lastPostAt: result.lastPostAt ?? null,
    socialLinks,
    links: [...links],
    contacts,
    source: result.source,
    providerScore: result.providerScore ?? null,
    raw: result.raw,
  };
}
