/** Shared types between the background worker, content scripts and popup. */

export interface ExtensionConfig {
  serverUrl: string;
  deviceId: string;
  organizationId: string;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  paused: boolean;
}

export interface JobTarget {
  platform: "INSTAGRAM" | "FACEBOOK";
  username: string | null;
  profileUrl: string | null;
  inboxUrl: string | null;
  externalId: string | null;
  externalThreadId: string | null;
}

export interface ClaimedJob {
  id: string;
  platform: "INSTAGRAM" | "FACEBOOK";
  target: JobTarget;
  payload: { text: string };
  attempts: number;
  maxAttempts: number;
  leaseExpiresAt: string;
}

export type ProgressStatus = "OPENING_TARGET" | "TARGET_FOUND" | "COMPOSER_FOUND" | "SENDING";

export type ErrorCode =
  | "NOT_LOGGED_IN"
  | "TARGET_NOT_FOUND"
  | "MESSAGE_BUTTON_NOT_FOUND"
  | "COMPOSER_NOT_FOUND"
  | "SEND_CONTROL_NOT_FOUND"
  | "SEND_NOT_CONFIRMED"
  | "ACCOUNT_RESTRICTED"
  | "RATE_LIMITED"
  | "PAGE_WARNING"
  | "NAVIGATION_TIMEOUT"
  | "UNKNOWN";

export interface JobResult {
  status: "SENT" | "FAILED" | "BLOCKED" | "REQUIRES_USER";
  errorCode?: ErrorCode;
  errorMessage?: string;
  evidence?: { finalUrl?: string; threadId?: string; sentText?: string; durationMs?: number };
}

/** Messages exchanged with content scripts. */
export type ContentRequest = { type: "OSES_PING" } | { type: "OSES_EXECUTE_JOB"; job: ClaimedJob };
export type ContentResponse = { type: "OSES_PONG"; loggedIn: boolean | null; url: string; platform: string } | { type: "OSES_ACK" };
export type RuntimeEvent = { type: "OSES_JOB_PROGRESS"; jobId: string; status: ProgressStatus; detail?: string } | { type: "OSES_JOB_RESULT"; jobId: string; result: JobResult };

export interface ActivityEntry {
  at: string;
  level: "info" | "warn" | "error";
  message: string;
}

export interface ExtensionState {
  currentJobId: string | null;
  lastHeartbeatAt: string | null;
  lastClaimAt: string | null;
  lastError: string | null;
  loggedIn: { instagram: boolean | null; facebook: boolean | null };
  activity: ActivityEntry[];
}

export const STORAGE_KEYS = { config: "oses.config", state: "oses.state" } as const;
export const EXTENSION_VERSION = "0.1.0";
