export * from "./places";
import { normalizeText } from "../text";
import { isValidTimeZone } from "../time";
import { CITY_TZ } from "./cities";
import { COUNTRY_ALIASES, COUNTRY_DEFAULT_TZ } from "./countries";
import { REGION_TZ } from "./regions";

export interface TimezoneResolution {
  timezone: string;
  /** how the zone was determined */
  source: "city" | "region" | "country" | "default";
  confidence: "high" | "medium" | "low";
  countryCode: string | null;
}

export function normalizeCountryCode(country: string | null | undefined): string | null {
  if (!country) return null;
  const raw = country.trim();
  if (/^[A-Za-z]{2}$/.test(raw) && COUNTRY_DEFAULT_TZ[raw.toUpperCase()]) return raw.toUpperCase();
  const key = normalizeText(raw);
  return COUNTRY_ALIASES[key] ?? null;
}

/**
 * Resolve an IANA timezone from a location. Never assumes the exporter's own zone:
 * when nothing is known the returned resolution is explicitly marked `default` / low confidence.
 */
export function resolveTimezone(
  location: { country?: string | null; region?: string | null; city?: string | null },
  fallback = "UTC",
): TimezoneResolution {
  const countryCode = normalizeCountryCode(location.country);
  const cityKey = normalizeText(location.city);
  const regionKey = normalizeText(location.region);

  if (cityKey) {
    const tz = CITY_TZ[cityKey];
    if (tz && (!countryCode || tzBelongsToCountry(tz, countryCode))) {
      return { timezone: tz, source: "city", confidence: "high", countryCode };
    }
  }
  if (countryCode && regionKey) {
    const tz = REGION_TZ[countryCode]?.[regionKey];
    if (tz) return { timezone: tz, source: "region", confidence: "high", countryCode };
  }
  // The city may have been written into the region field.
  if (regionKey && CITY_TZ[regionKey]) {
    const tz = CITY_TZ[regionKey] as string;
    if (!countryCode || tzBelongsToCountry(tz, countryCode)) return { timezone: tz, source: "city", confidence: "medium", countryCode };
  }
  if (countryCode) {
    const tz = COUNTRY_DEFAULT_TZ[countryCode];
    if (tz) {
      const multiZone = Boolean(REGION_TZ[countryCode]);
      return { timezone: tz, source: "country", confidence: multiZone ? "low" : "medium", countryCode };
    }
  }
  if (cityKey && CITY_TZ[cityKey]) {
    return { timezone: CITY_TZ[cityKey] as string, source: "city", confidence: "medium", countryCode };
  }
  return { timezone: isValidTimeZone(fallback) ? fallback : "UTC", source: "default", confidence: "low", countryCode };
}

const TZ_COUNTRY_PREFIX: Record<string, string[]> = {
  US: ["America/", "Pacific/Honolulu"],
  CA: ["America/"],
  AU: ["Australia/"],
  BR: ["America/"],
  MX: ["America/"],
  RU: ["Europe/", "Asia/"],
  ID: ["Asia/"],
};

function tzBelongsToCountry(tz: string, countryCode: string): boolean {
  const def = COUNTRY_DEFAULT_TZ[countryCode];
  if (def === tz) return true;
  const regional = REGION_TZ[countryCode];
  if (regional && Object.values(regional).includes(tz)) return true;
  const prefixes = TZ_COUNTRY_PREFIX[countryCode];
  if (prefixes) return prefixes.some((p) => tz.startsWith(p));
  return false;
}

export { CITY_TZ } from "./cities";
export { COUNTRY_ALIASES, COUNTRY_DEFAULT_TZ } from "./countries";
export { REGION_TZ } from "./regions";
