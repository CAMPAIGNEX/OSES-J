import { randomBytes, randomUUID } from "node:crypto";

/** RFC 9562 UUID v7 (time-ordered) - good index locality for InnoDB primary keys. */
export function uuidv7(now: number = Date.now()): string {
  const rand = randomBytes(10);
  const ts = BigInt(now);
  const bytes = Buffer.alloc(16);
  bytes[0] = Number((ts >> 40n) & 0xffn);
  bytes[1] = Number((ts >> 32n) & 0xffn);
  bytes[2] = Number((ts >> 24n) & 0xffn);
  bytes[3] = Number((ts >> 16n) & 0xffn);
  bytes[4] = Number((ts >> 8n) & 0xffn);
  bytes[5] = Number(ts & 0xffn);
  rand.copy(bytes, 6);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}

export function uuidv4(): string {
  return randomUUID();
}

/** Zero-padded human-friendly client id, e.g. CX-000001. */
export function formatCid(sequence: number, prefix = "CX", width = 6): string {
  return `${prefix}-${String(sequence).padStart(width, "0")}`;
}

export function parseCid(cid: string): { prefix: string; sequence: number } | null {
  const m = /^([A-Z]{1,5})-(\d{1,12})$/i.exec(cid.trim());
  if (!m) return null;
  return { prefix: (m[1] ?? "").toUpperCase(), sequence: Number.parseInt(m[2] ?? "0", 10) };
}
