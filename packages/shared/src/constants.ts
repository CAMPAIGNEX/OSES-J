/** Shared constants and enum-like unions mirrored by the database schema. */

export const PLATFORMS = ["INSTAGRAM", "FACEBOOK"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const SEARCH_PLATFORM_OPTIONS = ["INSTAGRAM", "FACEBOOK", "BOTH"] as const;
export type SearchPlatformOption = (typeof SEARCH_PLATFORM_OPTIONS)[number];

export const RESULT_COUNT_OPTIONS = [10, 20, 30, 50, 100] as const;

export const MESSAGING_MODES = ["MANUAL", "COPILOT", "AUTOPILOT"] as const;
export type MessagingMode = (typeof MESSAGING_MODES)[number];

export const CONTACT_CONFIDENCE = ["VERIFIED", "PUBLIC", "INFERRED"] as const;
export type ContactConfidence = (typeof CONTACT_CONFIDENCE)[number];

export const MESSAGING_ELIGIBILITY = ["DISCOVERED", "MESSAGEABLE", "NOT_MESSAGEABLE", "REQUIRES_USER", "PROVIDER_ERROR"] as const;
export type MessagingEligibility = (typeof MESSAGING_ELIGIBILITY)[number];

export const MESSAGE_JOB_STATUSES = [
  "QUEUED",
  "CLAIMED",
  "OPENING_TARGET",
  "TARGET_FOUND",
  "COMPOSER_FOUND",
  "SENDING",
  "SENT",
  "FAILED",
  "RETRYING",
  "BLOCKED",
  "REQUIRES_USER",
  "CANCELLED",
] as const;
export type MessageJobStatus = (typeof MESSAGE_JOB_STATUSES)[number];

export const AI_INTENTS = [
  "INTERESTED",
  "NOT_INTERESTED",
  "PRICE_REQUEST",
  "MOQ_REQUEST",
  "CATALOG_REQUEST",
  "SAMPLE_REQUEST",
  "DELIVERY_REQUEST",
  "PRODUCT_QUESTION",
  "NEGOTIATION",
  "NEEDS_HUMAN",
  "DO_NOT_CONTACT",
  "UNKNOWN",
] as const;
export type AIIntent = (typeof AI_INTENTS)[number];

export const CLIENT_STATUSES = [
  "NEW",
  "CONTACTED",
  "REPLIED",
  "INTERESTED",
  "NEGOTIATING",
  "CUSTOMER",
  "NOT_INTERESTED",
  "DO_NOT_CONTACT",
  "ARCHIVED",
] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const JOB_TYPES = [
  "DISCOVERY_JOB",
  "ENRICHMENT_JOB",
  "MESSAGE_JOB",
  "FOLLOWUP_JOB",
  "AI_REPLY_JOB",
  "AI_FIRST_MESSAGE_JOB",
  "EXPORT_JOB",
  "DOCUMENT_PROCESSING_JOB",
  "TRASH_CLEANUP_JOB",
  "CAMPAIGN_STEP_JOB",
  "SCHEDULED_MESSAGE_JOB",
  "COMPETITOR_ANALYSIS_JOB",
  "TREND_ANALYSIS_JOB",
  "WEBHOOK_EVENT_JOB",
] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const PROVIDER_KEYS = {
  MANUAL: "manual",
  EXTENSION: "extension",
  APIFY: "apify",
  META_INSTAGRAM: "meta_instagram",
  META_FACEBOOK: "meta_facebook",
} as const;
export type ProviderKey = (typeof PROVIDER_KEYS)[keyof typeof PROVIDER_KEYS];

export const BRAND_COLOR = "#007fff";

export const DEFAULT_FOLLOW_UP_DAYS = [3, 7, 14];

export const DEFAULT_RATE_LIMITS = { messagesPerHour: 20, messagesPerDay: 100 };

/** Retry backoff schedule (ms) for temporary failures: 30s, 2m, 10m, 30m. */
export const RETRY_BACKOFF_MS = [30_000, 120_000, 600_000, 1_800_000];
