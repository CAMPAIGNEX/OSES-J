import type { Platform } from "@oses/shared";

/** Normalized search criteria produced by the query parser + user filters. */
export interface SearchCriteria {
  query: string;
  keywords: string[];
  /** Platforms to search. */
  platforms: Platform[];
  minFollowers: number | null;
  maxFollowers: number | null;
  location: {
    country: string | null;
    countryCode: string | null;
    region: string | null;
    city: string | null;
  };
  category: string | null;
  limit: number;
  strategy: "auto" | "profile_search" | "search_engine" | "hashtag";
  filters: {
    hasWebsite?: boolean;
    hasEmail?: boolean;
    hasPhone?: boolean;
    hasWhatsApp?: boolean;
    activeRecently?: boolean;
    postedAfter?: string;
    postedBefore?: string;
    businessOnly?: boolean;
  };
  enrich: boolean;
  /** Hashtags derived from keywords (without #). */
  hashtags: string[];
}

export interface DiscoveryLocation {
  country?: string | null;
  region?: string | null;
  city?: string | null;
  address?: string | null;
}

export interface DiscoverySource {
  provider: string;
  actorId: string;
  adapter: string;
  providerRunId?: string | null;
  externalRunId?: string | null;
  fetchedAt: Date;
}

/**
 * A candidate account returned by a discovery provider, already mapped to a common shape.
 * Only fields the provider actually returned are populated. `raw` keeps the untouched item.
 */
export interface DiscoveryResult {
  platform: Platform;
  username: string | null;
  profileUrl: string;
  externalId?: string | null;
  displayName?: string | null;
  followers?: number | null;
  following?: number | null;
  postsCount?: number | null;
  bio?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  category?: string | null;
  isBusiness?: boolean | null;
  isVerified?: boolean | null;
  isPrivate?: boolean | null;
  location?: DiscoveryLocation | null;
  lastPostAt?: Date | null;
  /** Provider-side relevance (e.g. search rank), 0..1 when available. */
  providerScore?: number | null;
  /** Extra links found (e.g. linktree), useful for enrichment. */
  links?: string[];
  raw: unknown;
  source: DiscoverySource;
}

export interface ProviderRunMeta {
  provider: string;
  actorId: string;
  adapter: string;
  purpose: "DISCOVERY" | "PROFILE_ENRICHMENT" | "CONTENT" | "MESSAGING";
  externalRunId?: string | null;
  datasetId?: string | null;
  status: "SUCCEEDED" | "FAILED" | "TIMED_OUT" | "ABORTED";
  input: unknown;
  itemCount: number;
  costUsd?: number | null;
  error?: string | null;
  startedAt: Date;
  finishedAt: Date;
}

export interface DiscoveryBatch {
  results: DiscoveryResult[];
  runs: ProviderRunMeta[];
  warnings: string[];
}

export interface DiscoveryContext {
  organizationId: string;
  searchRunId?: string;
  /** Called after each provider run so callers can persist provider metadata incrementally. */
  onProviderRun?: (run: ProviderRunMeta) => Promise<void> | void;
  onProgress?: (stage: string, detail?: Record<string, unknown>) => Promise<void> | void;
  signal?: AbortSignal;
}

/** Contract every discovery provider implements. */
export interface DiscoveryProvider {
  readonly key: string;
  readonly platform: Platform;
  readonly strategy: SearchCriteria["strategy"];
  /** Relative order when several providers can serve the same platform (lower first). */
  readonly priority: number;
  supports(criteria: SearchCriteria): boolean;
  search(criteria: SearchCriteria, ctx: DiscoveryContext): Promise<DiscoveryBatch>;
}

/** Contract for fetching full profile details for known accounts (used by enrichment). */
export interface ProfileProvider {
  readonly key: string;
  readonly platform: Platform;
  fetchProfiles(targets: Array<{ username: string | null; profileUrl: string; externalId?: string | null }>, ctx: DiscoveryContext): Promise<DiscoveryBatch>;
}

/** Normalized public post used by competitor/trend analysis. */
export interface ContentResult {
  platform: Platform;
  accountUsername: string | null;
  accountName: string | null;
  accountUrl: string | null;
  postUrl: string | null;
  externalId: string | null;
  postedAt: Date | null;
  caption: string | null;
  hashtags: string[];
  likes: number | null;
  comments: number | null;
  views: number | null;
  mediaType: string | null;
  location: string | null;
  raw: unknown;
  source: DiscoverySource;
}

export interface ContentBatch {
  results: ContentResult[];
  runs: ProviderRunMeta[];
  warnings: string[];
}

export interface ContentCriteria {
  platform: Platform;
  keywords: string[];
  hashtags: string[];
  location: SearchCriteria["location"];
  limit: number;
  dateFrom: Date | null;
  dateTo: Date | null;
}

export interface ContentProvider {
  readonly key: string;
  readonly platform: Platform;
  fetchContent(criteria: ContentCriteria, ctx: DiscoveryContext): Promise<ContentBatch>;
}
