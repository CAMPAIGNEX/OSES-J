/** Text normalization and similarity helpers used by dedupe and entity resolution. */

const DIACRITICS = /[̀-ͯ]/g;

export function stripDiacritics(input: string): string {
  return input.normalize("NFD").replace(DIACRITICS, "");
}

/** Lowercase, strip diacritics/punctuation, collapse whitespace. */
export function normalizeText(input: string | null | undefined): string {
  if (!input) return "";
  return stripDiacritics(input)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BRAND_STOPWORDS = new Set([
  "the", "official", "shop", "store", "inc", "llc", "ltd", "co", "company", "brand", "apparel", "clothing",
  "wear", "page", "us", "usa", "uk", "com", "io", "and", "of",
]);

/** Brand-name key for fuzzy matching: removes generic suffixes and stopwords. */
export function brandKey(input: string | null | undefined): string {
  const tokens = normalizeText(input).split(" ").filter((t) => t && !BRAND_STOPWORDS.has(t));
  return tokens.join(" ");
}

export function slugify(input: string): string {
  return normalizeText(input).replace(/\s+/g, "-").replace(/^-+|-+$/g, "");
}

export function tokenize(input: string | null | undefined): string[] {
  return normalizeText(input).split(" ").filter(Boolean);
}

/** Sorensen-Dice coefficient on character bigrams (0..1). */
export function diceCoefficient(a: string, b: string): number {
  const x = normalizeText(a).replace(/\s/g, "");
  const y = normalizeText(b).replace(/\s/g, "");
  if (!x.length || !y.length) return 0;
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;
  const bigrams = new Map<string, number>();
  for (let i = 0; i < x.length - 1; i++) {
    const bg = x.slice(i, i + 2);
    bigrams.set(bg, (bigrams.get(bg) ?? 0) + 1);
  }
  let intersection = 0;
  for (let i = 0; i < y.length - 1; i++) {
    const bg = y.slice(i, i + 2);
    const count = bigrams.get(bg) ?? 0;
    if (count > 0) {
      bigrams.set(bg, count - 1);
      intersection++;
    }
  }
  return (2 * intersection) / (x.length - 1 + (y.length - 1));
}

/** Jaro-Winkler similarity (0..1). */
export function jaroWinkler(s1: string, s2: string): number {
  const a = normalizeText(s1);
  const b = normalizeText(s2);
  if (!a.length || !b.length) return 0;
  if (a === b) return 1;
  const matchDistance = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array<boolean>(a.length).fill(false);
  const bMatches = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  const m = matches;
  const jaro = (m / a.length + m / b.length + (m - transpositions / 2) / m) / 3;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

/** Token-set overlap (Jaccard) of normalized words. */
export function tokenJaccard(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

export function truncate(input: string, max: number, suffix = "..."): string {
  if (input.length <= max) return input;
  return input.slice(0, Math.max(0, max - suffix.length)).trimEnd() + suffix;
}

export function countWords(input: string): number {
  return tokenize(input).length;
}

/** Cheap token estimate for prompt budgeting (roughly 4 chars per token). */
export function estimateTokens(input: string): number {
  return Math.ceil(input.length / 4);
}

export function titleCase(input: string): string {
  return input
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}
