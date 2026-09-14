import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

type ScryptFn = (
  password: string,
  salt: Buffer,
  keylen: number,
  opts: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const scrypt = promisify(scryptCb) as unknown as ScryptFn;

/** URL-safe random token (default 32 bytes = 43 chars). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Human-friendly code (no ambiguous characters), e.g. for extension pairing. */
export function randomCode(length = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[(bytes[i] ?? 0) % alphabet.length];
  return out;
}

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hmacSha256Hex(secret: string, input: string | Buffer): string {
  return createHmac("sha256", secret).update(input).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// ---------- Password hashing (scrypt, OWASP-recommended parameters) ----------

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM });
  return ["scrypt", SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4] ?? "", "base64");
  const expected = Buffer.from(parts[5] ?? "", "base64");
  if (!salt.length || !expected.length) return false;
  const key = await scrypt(password, salt, expected.length, { N, r, p, maxmem: SCRYPT_MAXMEM });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// ---------- Secret encryption at rest (AES-256-GCM) ----------

function keyFromString(key: string | undefined): Buffer {
  if (!key) throw new Error("ENCRYPTION_KEY is not configured");
  const buf = /^[0-9a-f]{64}$/i.test(key) ? Buffer.from(key, "hex") : Buffer.from(key, "base64");
  if (buf.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes (base64 or hex encoded)");
  return buf;
}

/**
 * Encrypts a secret for storage. Output format: v1.<iv>.<tag>.<ciphertext> (base64url parts).
 * The key is passed explicitly so this module stays independent of env loading.
 */
export function encryptSecret(plaintext: string, key: string | undefined): string {
  const k = keyFromString(key);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(".");
}

export function decryptSecret(payload: string, key: string | undefined): string {
  const k = keyFromString(key);
  const [version, ivB, tagB, dataB] = payload.split(".");
  if (version !== "v1" || !ivB || !tagB || !dataB) throw new Error("Invalid encrypted payload");
  const decipher = createDecipheriv("aes-256-gcm", k, Buffer.from(ivB, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataB, "base64url")), decipher.final()]).toString("utf8");
}

/** Show only the tail of a secret for UI display, never the whole value. */
export function maskSecret(value: string | null | undefined, visible = 4): string {
  if (!value) return "";
  if (value.length <= visible) return "*".repeat(value.length);
  return "*".repeat(Math.min(12, value.length - visible)) + value.slice(-visible);
}
