import type { Client, DbClient, OrganizationSettings } from "@oses/database";
import { getOrCreateSettings, parseFollowUpDays, parseWorkingHours, type WorkingHoursSettings } from "@oses/database";
import { isValidTimeZone, isWithinWorkingHours, nextWorkingSlot, resolveTimezone } from "@oses/shared";
import type { PreferredProvider } from "@oses/messaging";

/**
 * Autopilot policy: every automated decision goes through these helpers so the AI can never bypass
 * the exporter's configuration (mode, approvals, working hours, do-not-contact, confidence threshold).
 */

export interface AutopilotPolicy {
  settings: OrganizationSettings;
  workingHours: WorkingHoursSettings;
  followUpDays: number[];
  organizationTimezone: string;
  preferredProvider: PreferredProvider;
}

export async function loadPolicy(db: DbClient, organizationId: string): Promise<AutopilotPolicy> {
  const settings = await getOrCreateSettings(db, organizationId);
  const org = await db.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { timezone: true } });
  return {
    settings,
    workingHours: parseWorkingHours(settings.workingHours),
    followUpDays: parseFollowUpDays(settings.followUpDays),
    organizationTimezone: org.timezone,
    preferredProvider: (settings.preferredProvider as PreferredProvider) ?? "auto",
  };
}

export type AutomatedKind = "first_message" | "reply" | "follow_up";

/** Is the AI allowed to send this kind of message without a human clicking Send? */
export function autoSendAllowed(policy: AutopilotPolicy, kind: AutomatedKind): boolean {
  const s = policy.settings;
  if (s.messagingMode !== "AUTOPILOT" || !s.autopilotEnabled) return false;
  if (kind === "first_message") return s.autoFirstMessage && !s.requireApprovalFirstMessage;
  if (kind === "reply") return s.autoReply;
  return s.autoFollowUp;
}

/** Should the generated message be parked as a suggestion awaiting approval? */
export function approvalRequired(policy: AutopilotPolicy, kind: AutomatedKind, hasAttachments = false): boolean {
  if (!autoSendAllowed(policy, kind)) return true;
  if (hasAttachments && policy.settings.requireApprovalAttachments) return true;
  return false;
}

export function meetsConfidence(policy: AutopilotPolicy, confidence: number | null | undefined): boolean {
  if (confidence == null) return false;
  return confidence >= policy.settings.confidenceThreshold;
}

/** Timezone used for outbound timing for this client according to the working-hours mode. */
export function timezoneForClient(policy: AutopilotPolicy, client: Pick<Client, "timezone" | "country" | "region" | "city">): string {
  const wh = policy.workingHours;
  if (wh.timezoneMode === "exporter") return policy.organizationTimezone;
  if (wh.timezoneMode === "custom" && wh.customTimezone && isValidTimeZone(wh.customTimezone)) return wh.customTimezone;
  if (client.timezone && isValidTimeZone(client.timezone)) return client.timezone;
  const resolved = resolveTimezone({ country: client.country, region: client.region, city: client.city }, policy.organizationTimezone);
  return resolved.timezone;
}

/** Earliest instant an automated message may go out (now if inside the window or working hours are off). */
export function nextSendTime(policy: AutopilotPolicy, client: Pick<Client, "timezone" | "country" | "region" | "city">, from: Date = new Date()): { at: Date; timezone: string; delayed: boolean } {
  const timezone = timezoneForClient(policy, client);
  if (!policy.workingHours.enabled) return { at: from, timezone, delayed: false };
  const inside = isWithinWorkingHours(from, timezone, policy.workingHours);
  if (inside) return { at: from, timezone, delayed: false };
  return { at: nextWorkingSlot(from, timezone, policy.workingHours), timezone, delayed: true };
}

export function isContactable(client: Pick<Client, "doNotContact" | "status" | "deletedAt">): boolean {
  return !client.deletedAt && !client.doNotContact && client.status !== "DO_NOT_CONTACT" && client.status !== "ARCHIVED";
}
