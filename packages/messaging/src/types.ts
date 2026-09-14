import type { DbClient } from "@oses/database";
import type { ErrorClass, MessagingEligibility, Platform } from "@oses/shared";

/** Where a message should go. A profile URL never implies permission to message; eligibility is explicit. */
export interface MessageTarget {
  platform: Platform;
  clientId: string;
  clientSocialAccountId: string | null;
  username: string | null;
  profileUrl: string | null;
  inboxUrl: string | null;
  externalId: string | null;
  externalThreadId: string | null;
  /** Meta page-scoped / Instagram-scoped id (only exists after the prospect messaged the connected account). */
  scopedUserId: string | null;
  socialConnectionId: string | null;
}

export interface CapabilityResult {
  canSend: boolean;
  eligibility: MessagingEligibility;
  reason: string | null;
  /** True when a human must do something first (log in, reconnect, install extension). */
  requiresUser: boolean;
}

export interface SendMessageRequest {
  organizationId: string;
  messageId: string;
  conversationId: string;
  target: MessageTarget;
  text: string;
  attachments?: Array<{ name: string; url: string; mimeType?: string | null }>;
  priority?: number;
  scheduledAt?: Date;
}

export type SendStatus = "SENT" | "QUEUED" | "FAILED" | "REQUIRES_USER" | "NOT_MESSAGEABLE";

export interface SendMessageResult {
  status: SendStatus;
  providerKey: string;
  /** Delivery job created for asynchronous providers. */
  jobId?: string | null;
  providerMessageId?: string | null;
  externalThreadId?: string | null;
  error?: string | null;
  errorClass?: ErrorClass | null;
  /** Whether the provider will report delivery/seen states (never fabricated when false). */
  statusTracking: boolean;
}

export interface ProviderContext {
  db: DbClient;
  organizationId: string;
}

/** Contract implemented by every outbound messaging provider. */
export interface MessagingProvider {
  readonly key: string;
  readonly platforms: Platform[];
  /** Human-readable label for the UI ("Browser extension", "Instagram (official API)"). */
  readonly label: string;
  canSend(target: MessageTarget, ctx: ProviderContext): Promise<CapabilityResult>;
  sendMessage(request: SendMessageRequest, ctx: ProviderContext): Promise<SendMessageResult>;
}

export interface ProviderDecision {
  provider: MessagingProvider | null;
  providerKey: string;
  capability: CapabilityResult;
  /** Every provider that was considered and why it was skipped, for transparency. */
  considered: Array<{ providerKey: string; capability: CapabilityResult }>;
}

/** Job payload stored on MessageJob.target / MessageJob.payload. */
export interface MessageJobTarget extends MessageTarget {
  decisionReason?: string | null;
}

export interface MessageJobPayload {
  text: string;
  attachments?: Array<{ name: string; url: string; mimeType?: string | null }>;
  /** Provider-specific settings snapshot (e.g. Apify actor id) captured at enqueue time. */
  provider?: Record<string, unknown>;
}
