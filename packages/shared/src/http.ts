import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { AppError } from "./errors";

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
}

/** fetch() with a timeout. */
export async function fetchWithTimeout(url: string, options: FetchOptions = {}): Promise<Response> {
  const { timeoutMs = 15_000, ...init } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: init.signal ?? controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Read a text body but stop after `maxBytes`. */
export async function readTextCapped(res: Response, maxBytes = 2_000_000): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return await res.text();
  const chunks: Buffer[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel().catch(() => undefined);
        break;
      }
      chunks.push(Buffer.from(value));
    }
  }
  return Buffer.concat(chunks).toString("utf8");
}

// ---------- SSRF protection ----------

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const PRIVATE_V4_RANGES: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

export function isPrivateIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) {
    const n = ipv4ToInt(ip);
    return PRIVATE_V4_RANGES.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (n & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (kind === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("::ffff:")) return isPrivateIp(lower.slice(7));
    return false;
  }
  return true;
}

/**
 * Ensure a URL is a public http(s) address before the server fetches it.
 * Rejects private/loopback/link-local targets and non-http schemes.
 */
export async function assertPublicHttpUrl(input: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new AppError("INVALID_URL", "Invalid URL", { status: 400 });
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new AppError("INVALID_URL", "Only http(s) URLs are allowed", { status: 400 });
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new AppError("BLOCKED_URL", "Target host is not allowed", { status: 400 });
  }
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new AppError("BLOCKED_URL", "Target host is not allowed", { status: 400 });
    return url;
  }
  try {
    const results = await lookup(host, { all: true });
    if (!results.length || results.some((r) => isPrivateIp(r.address))) {
      throw new AppError("BLOCKED_URL", "Target host resolves to a private address", { status: 400 });
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("DNS_FAILURE", `Could not resolve ${host}`, { status: 400, cause: err });
  }
  return url;
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
