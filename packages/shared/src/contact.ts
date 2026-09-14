/** Contact normalization: emails, phones, WhatsApp. Best-effort and conservative; never invents data. */

const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|css|js)$/i;

export function normalizeEmail(input: string | null | undefined): string | null {
  if (!input) return null;
  const e = input.trim().toLowerCase().replace(/^mailto:/, "").split("?")[0] ?? "";
  if (!EMAIL_RE.test(e) || IMAGE_EXT.test(e)) return null;
  return e;
}

export function isGenericEmail(email: string): boolean {
  return /^(info|hello|contact|support|sales|team|hi|office|admin|help|press|wholesale|orders?|customerservice|customer\.service)@/i.test(email);
}

export function isPlaceholderEmail(email: string): boolean {
  return /(example\.com|sentry\.io|wixpress\.com|yourdomain|domain\.com|email\.com|test\.com|@2x\.)/i.test(email) || /\.(png|jpg|gif)@/i.test(email);
}

export function extractEmails(text: string | null | undefined): string[] {
  if (!text) return [];
  const out = new Set<string>();
  const re = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const e = normalizeEmail(m[0]);
    if (e && !isPlaceholderEmail(e)) out.add(e);
  }
  return [...out];
}

/**
 * Normalize a phone number to a digits-only international form when possible ("+14155551234").
 * Returns null for strings that do not look like phone numbers. Does not validate country plans.
 */
export function normalizePhone(input: string | null | undefined, defaultCountryCode?: string): string | null {
  if (!input) return null;
  let raw = input.trim().replace(/^tel:/i, "").replace(/^callto:/i, "");
  raw = raw.replace(/[\s().‐-―-]/g, "");
  if (raw.startsWith("00")) raw = "+" + raw.slice(2);
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  if (hasPlus) return "+" + digits;
  if (defaultCountryCode && !digits.startsWith(defaultCountryCode.replace("+", ""))) {
    const trimmed = digits.replace(/^0/, "");
    return "+" + defaultCountryCode.replace("+", "") + trimmed;
  }
  return digits.length >= 10 ? "+" + digits : null;
}

export function extractPhones(text: string | null | undefined): string[] {
  if (!text) return [];
  const out = new Set<string>();
  const re = /(?:\+|00)?\d[\d\s().-]{6,18}\d/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const candidate = m[0];
    // skip things that look like dates, prices, order numbers
    const digits = candidate.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) continue;
    if (/^(19|20)\d{6}$/.test(digits)) continue;
    const p = normalizePhone(candidate);
    if (p) out.add(p);
  }
  return [...out];
}

/** Extract WhatsApp numbers from wa.me / api.whatsapp.com links. */
export function extractWhatsAppNumbers(text: string | null | undefined): string[] {
  if (!text) return [];
  const out = new Set<string>();
  const re = /(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=|whatsapp\.com\/send\/?\?phone=)\+?(\d{7,15})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const p = normalizePhone("+" + (m[1] ?? ""));
    if (p) out.add(p);
  }
  return [...out];
}

export function emailDomain(email: string | null | undefined): string | null {
  const e = normalizeEmail(email);
  if (!e) return null;
  return e.split("@")[1] ?? null;
}

export function isFreeMailDomain(domain: string | null | undefined): boolean {
  if (!domain) return false;
  return /^(gmail\.com|yahoo\.[a-z.]+|hotmail\.[a-z.]+|outlook\.[a-z.]+|live\.[a-z.]+|icloud\.com|me\.com|aol\.com|protonmail\.com|proton\.me|mail\.com|gmx\.[a-z.]+|yandex\.[a-z.]+|zoho\.com)$/i.test(domain);
}
