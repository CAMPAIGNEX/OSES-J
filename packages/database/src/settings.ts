import { DEFAULT_FOLLOW_UP_DAYS, type WorkingHours } from "@oses/shared";
import type { OrganizationSettings } from "../generated/prisma/client";
import type { DbClient } from "./client";

export interface WorkingHoursSettings extends WorkingHours {
  timezoneMode: "client" | "exporter" | "custom";
  customTimezone?: string | null;
}

export const DEFAULT_WORKING_HOURS: WorkingHoursSettings = {
  enabled: false,
  start: "10:00",
  end: "17:00",
  days: [1, 2, 3, 4, 5],
  timezoneMode: "client",
  customTimezone: null,
};

/** Fetch (or create with defaults) the settings row for an organization. */
export async function getOrCreateSettings(tx: DbClient, organizationId: string): Promise<OrganizationSettings> {
  const existing = await tx.organizationSettings.findUnique({ where: { organizationId } });
  if (existing) return existing;
  return tx.organizationSettings.upsert({
    where: { organizationId },
    create: { organizationId, followUpDays: DEFAULT_FOLLOW_UP_DAYS, workingHours: DEFAULT_WORKING_HOURS as unknown as object },
    update: {},
  });
}

export function parseWorkingHours(value: unknown): WorkingHoursSettings {
  if (!value || typeof value !== "object") return DEFAULT_WORKING_HOURS;
  const v = value as Partial<WorkingHoursSettings>;
  return {
    enabled: Boolean(v.enabled),
    start: typeof v.start === "string" ? v.start : DEFAULT_WORKING_HOURS.start,
    end: typeof v.end === "string" ? v.end : DEFAULT_WORKING_HOURS.end,
    days: Array.isArray(v.days) && v.days.length ? v.days.filter((d): d is number => typeof d === "number") : DEFAULT_WORKING_HOURS.days,
    timezoneMode: v.timezoneMode === "exporter" || v.timezoneMode === "custom" ? v.timezoneMode : "client",
    customTimezone: typeof v.customTimezone === "string" ? v.customTimezone : null,
  };
}

export function parseFollowUpDays(value: unknown): number[] {
  if (!Array.isArray(value)) return DEFAULT_FOLLOW_UP_DAYS;
  const days = value.filter((d): d is number => typeof d === "number" && d > 0 && d <= 90);
  return days.length ? days : DEFAULT_FOLLOW_UP_DAYS;
}
