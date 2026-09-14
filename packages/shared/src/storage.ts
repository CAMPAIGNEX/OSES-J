import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { getEnv } from "./env";
import { ConfigurationError } from "./errors";

/**
 * File storage abstraction for documents and exports.
 * The local driver writes under STORAGE_DIR (outside the web root). An S3-compatible driver can be
 * added behind the same interface without touching document/export code.
 */
export interface StoredFile {
  key: string;
  sizeBytes: number;
  checksum: string;
}

export interface StorageProvider {
  readonly driver: string;
  put(key: string, data: Buffer): Promise<StoredFile>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

function safeKey(key: string): string {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.includes("..")) throw new ConfigurationError("Invalid storage key");
  return normalized;
}

export class LocalStorageProvider implements StorageProvider {
  readonly driver = "local";
  constructor(private readonly rootDir: string) {}

  private resolve(key: string): string {
    const full = path.resolve(this.rootDir, safeKey(key));
    if (!full.startsWith(path.resolve(this.rootDir))) throw new ConfigurationError("Invalid storage key");
    return full;
  }

  async put(key: string, data: Buffer): Promise<StoredFile> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
    return { key: safeKey(key), sizeBytes: data.byteLength, checksum: createHash("sha256").update(data).digest("hex") };
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}

let cached: StorageProvider | undefined;

export function getStorage(): StorageProvider {
  if (cached) return cached;
  const env = getEnv();
  cached = new LocalStorageProvider(path.resolve(/*turbopackIgnore: true*/ process.cwd(), env.STORAGE_DIR));
  return cached;
}

export function setStorageForTests(provider: StorageProvider | undefined): void {
  cached = provider;
}

/** Deterministic, collision-resistant key: org/kind/yyyy/mm/<random>-<name> */
export function buildStorageKey(organizationId: string, kind: string, fileName: string): string {
  const now = new Date();
  const safeName = fileName.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120);
  const rand = createHash("sha256").update(`${organizationId}${kind}${fileName}${now.getTime()}${Math.random()}`).digest("hex").slice(0, 12);
  return `${organizationId}/${kind.toLowerCase()}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${rand}-${safeName}`;
}
