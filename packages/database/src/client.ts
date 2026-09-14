import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { createLogger, getEnv } from "@oses/shared";
import { PrismaClient } from "../generated/prisma/client";
import { parseMysqlUrl } from "./connection";

const log = createLogger("db");

export type Db = PrismaClient;

/** Transaction client type usable by services that accept either the root client or a transaction. */
export type DbClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0] | PrismaClient;

declare global {
  // eslint-disable-next-line no-var
  var __osesPrisma: PrismaClient | undefined;
}

export function createPrismaClient(databaseUrl?: string): PrismaClient {
  const env = getEnv();
  const options = parseMysqlUrl(databaseUrl ?? env.DATABASE_URL, env.JOB_RUNNER_MODE === "worker" ? env.WORKER_CONCURRENCY + 2 : 5);
  const adapter = new PrismaMariaDb({
    host: options.host,
    port: options.port,
    user: options.user,
    password: options.password,
    database: options.database,
    connectionLimit: options.connectionLimit,
    ...(options.ssl ? { ssl: options.ssl } : {}),
  });
  const client = new PrismaClient({
    adapter,
    log: env.LOG_LEVEL === "debug" ? [{ level: "warn", emit: "stdout" }, { level: "error", emit: "stdout" }] : [{ level: "error", emit: "stdout" }],
  });
  log.debug("Prisma client created", { host: options.host, database: options.database });
  return client;
}

/**
 * Process-wide Prisma singleton. Cached on globalThis so Next.js dev hot-reloads do not
 * exhaust MySQL connections.
 */
export function getDb(): PrismaClient {
  if (!globalThis.__osesPrisma) {
    globalThis.__osesPrisma = createPrismaClient();
  }
  return globalThis.__osesPrisma;
}

export async function disconnectDb(): Promise<void> {
  if (globalThis.__osesPrisma) {
    await globalThis.__osesPrisma.$disconnect();
    globalThis.__osesPrisma = undefined;
  }
}

/** Lazily-resolved proxy so modules can `import { db }` without connecting at import time. */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getDb() as unknown as Record<string | symbol, unknown>;
    const value = client[prop];
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});
