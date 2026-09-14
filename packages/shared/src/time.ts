/** Time helpers: timezone-aware working hours and scheduling math (no external dependency). */

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 = Sunday
}

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    partsCache.set(tz, f);
  }
  return f;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Break a UTC instant into wall-clock parts in the given IANA zone. */
export function zonedParts(date: Date, tz: string): ZonedParts {
  const parts = formatter(tz).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: WEEKDAYS.indexOf(get("weekday")),
  };
}

/** Offset of `tz` from UTC in minutes at the given instant. */
export function tzOffsetMinutes(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** Convert wall-clock time in `tz` to a UTC Date. */
export function zonedTimeToUtc(parts: { year: number; month: number; day: number; hour: number; minute: number; second?: number }, tz: string): Date {
  const guess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second ?? 0));
  const offset1 = tzOffsetMinutes(guess, tz);
  const candidate = new Date(guess.getTime() - offset1 * 60000);
  const offset2 = tzOffsetMinutes(candidate, tz);
  if (offset1 === offset2) return candidate;
  return new Date(guess.getTime() - offset2 * 60000);
}

export function parseHHMM(input: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(input.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export interface WorkingHours {
  enabled: boolean;
  /** "HH:MM" 24h */
  start: string;
  end: string;
  /** 0=Sunday..6=Saturday; defaults to Monday-Friday when omitted */
  days?: number[];
}

/** True when the instant falls inside the working window in `tz`. */
export function isWithinWorkingHours(date: Date, tz: string, wh: WorkingHours): boolean {
  if (!wh.enabled) return true;
  const start = parseHHMM(wh.start);
  const end = parseHHMM(wh.end);
  if (!start || !end) return true;
  const p = zonedParts(date, tz);
  const days = wh.days && wh.days.length ? wh.days : [1, 2, 3, 4, 5];
  if (!days.includes(p.weekday)) return false;
  const now = p.hour * 60 + p.minute;
  const s = start.hour * 60 + start.minute;
  const e = end.hour * 60 + end.minute;
  if (s <= e) return now >= s && now < e;
  // overnight window (e.g. 22:00-06:00)
  return now >= s || now < e;
}

/**
 * Next instant at or after `from` that lies inside the working window in `tz`.
 * Returns `from` itself when already inside.
 */
export function nextWorkingSlot(from: Date, tz: string, wh: WorkingHours): Date {
  if (!wh.enabled) return from;
  const start = parseHHMM(wh.start);
  const end = parseHHMM(wh.end);
  if (!start || !end) return from;
  if (isWithinWorkingHours(from, tz, wh)) return from;
  const days = wh.days && wh.days.length ? wh.days : [1, 2, 3, 4, 5];
  const p = zonedParts(from, tz);
  for (let i = 0; i < 15; i++) {
    const dayStartUtc = zonedTimeToUtc({ year: p.year, month: p.month, day: p.day + i, hour: start.hour, minute: start.minute }, tz);
    const dayParts = zonedParts(dayStartUtc, tz);
    if (!days.includes(dayParts.weekday)) continue;
    if (dayStartUtc.getTime() >= from.getTime()) return dayStartUtc;
  }
  return from;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatInZone(date: Date, tz: string, opts: Intl.DateTimeFormatOptions = {}): string {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, dateStyle: "medium", timeStyle: "short", ...opts }).format(date);
  } catch {
    return date.toISOString();
  }
}
