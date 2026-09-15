import { normalizeText } from "../text";
import { CITY_TZ } from "./cities";

/**
 * City names the way people actually type them. "newyork", "NewYork", "NYC" and "new york city" all mean
 * New York; a search must never fail because of a missing space or a nickname.
 */
const CITY_ALIASES: Record<string, string> = {
  nyc: "new york",
  "new york city": "new york",
  "ny city": "new york",
  la: "los angeles",
  sf: "san francisco",
  "san fran": "san francisco",
  bombay: "mumbai",
  calcutta: "kolkata",
  madras: "chennai",
  "saigon": "ho chi minh city",
  frisco: "san francisco",
  philly: "philadelphia",
  "d c": "washington",
  dc: "washington",
  "washington dc": "washington",
  "washington d c": "washington",
  "mexico df": "mexico city",
  "cdmx": "mexico city",
  brum: "birmingham",
  "abu dhabi city": "abu dhabi",
};

let compactIndex: Map<string, string> | null = null;

/** Lower-case canonical keys of every known city, indexed by their space-less form ("newyork" -> "new york"). */
function index(): Map<string, string> {
  if (compactIndex) return compactIndex;
  compactIndex = new Map();
  for (const key of Object.keys(CITY_TZ)) {
    const canonical = CITY_ALIASES[key] ?? key;
    compactIndex.set(key.replace(/\s+/g, ""), canonical);
  }
  for (const [alias, canonical] of Object.entries(CITY_ALIASES)) compactIndex.set(alias.replace(/\s+/g, ""), canonical);
  return compactIndex;
}

/** Canonical lower-case city key for any spelling we recognise, or null when the place is unknown. */
export function canonicalCityKey(input: string | null | undefined): string | null {
  const n = normalizeText(input);
  if (!n) return null;
  if (CITY_ALIASES[n]) return CITY_ALIASES[n];
  if (CITY_TZ[n]) return n;
  return index().get(n.replace(/\s+/g, "")) ?? null;
}

/** Display form of a city: canonical spelling when known ("newyork" -> "New York"), otherwise the input title-cased. */
export function canonicalCity(input: string | null | undefined): string | null {
  const raw = input?.trim();
  if (!raw) return null;
  const key = canonicalCityKey(raw);
  return titleCase(key ?? raw);
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}
