import { z } from "zod";
import { idSchema } from "./common";

/** POST /api/extension/auth — exchange a pairing code for device tokens. */
export const extensionAuthSchema = z.object({
  pairingCode: z.string().trim().min(6).max(12),
  deviceName: z.string().trim().min(1).max(120).default("Chrome"),
  browser: z.string().trim().max(120).optional(),
  extensionVersion: z.string().trim().max(40).optional(),
});

export const extensionRefreshSchema = z.object({ refreshToken: z.string().min(20).max(500) });

export const extensionHeartbeatSchema = z.object({
  status: z.enum(["ready", "busy", "needs_login", "error"]).default("ready"),
  capabilities: z
    .object({
      instagram: z.boolean().optional(),
      facebook: z.boolean().optional(),
      loggedIn: z.record(z.string(), z.boolean()).optional(),
    })
    .optional(),
  extensionVersion: z.string().max(40).optional(),
  currentJobId: idSchema.optional().nullable(),
});

export const extensionClaimSchema = z.object({
  platforms: z.array(z.enum(["INSTAGRAM", "FACEBOOK"])).min(1).default(["INSTAGRAM", "FACEBOOK"]),
});

export const EXTENSION_PROGRESS_STATUSES = ["OPENING_TARGET", "TARGET_FOUND", "COMPOSER_FOUND", "SENDING"] as const;

export const extensionProgressSchema = z.object({
  status: z.enum(EXTENSION_PROGRESS_STATUSES),
  detail: z.string().max(500).optional(),
});

export const EXTENSION_RESULT_STATUSES = ["SENT", "FAILED", "BLOCKED", "REQUIRES_USER"] as const;

export const extensionResultSchema = z.object({
  status: z.enum(EXTENSION_RESULT_STATUSES),
  errorCode: z
    .enum([
      "NOT_LOGGED_IN",
      "TARGET_NOT_FOUND",
      "MESSAGE_BUTTON_NOT_FOUND",
      "COMPOSER_NOT_FOUND",
      "SEND_CONTROL_NOT_FOUND",
      "SEND_NOT_CONFIRMED",
      "ACCOUNT_RESTRICTED",
      "RATE_LIMITED",
      "PAGE_WARNING",
      "NAVIGATION_TIMEOUT",
      "UNKNOWN",
    ])
    .optional(),
  errorMessage: z.string().max(1000).optional(),
  evidence: z
    .object({
      finalUrl: z.string().max(2048).optional(),
      threadId: z.string().max(120).optional(),
      sentText: z.string().max(4000).optional(),
      durationMs: z.number().int().min(0).optional(),
    })
    .optional(),
});
export type ExtensionResultInput = z.infer<typeof extensionResultSchema>;
