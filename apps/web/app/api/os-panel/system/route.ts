import { getPlatformConfig } from "@oses/database";
import { checkEnv, getEnv, getRecentLogs } from "@oses/shared";
import { withApi } from "@/lib/server/api";

/** Platform health for operators: configuration (names only), runtime, queue depth and provider defaults. */
export const GET = withApi(
  async ({ db }) => {
    const env = getEnv();
    const config = checkEnv();
    const started = Date.now();
    let dbLatencyMs: number | null = null;
    let dbError: string | null = null;
    let dbVersion: string | null = null;
    let dbSqlMode: string | null = null;
    try {
      const rows = await db.$queryRaw<Array<{ version: string; sqlMode: string }>>`SELECT VERSION() AS version, @@SESSION.sql_mode AS sqlMode`;
      dbLatencyMs = Date.now() - started;
      dbVersion = rows[0]?.version ?? null;
      dbSqlMode = rows[0]?.sqlMode ?? null;
    } catch (err) {
      dbError = (err as Error).message;
    }
    const platform = await getPlatformConfig(db);
    const [queued, running, failed24h, oldestQueued, devices, connections, lastJob] = await Promise.all([
      db.automationJob.count({ where: { status: "QUEUED" } }),
      db.automationJob.count({ where: { status: "RUNNING" } }),
      db.automationJob.count({ where: { status: "FAILED", updatedAt: { gte: new Date(Date.now() - 86_400_000) } } }),
      db.automationJob.findFirst({ where: { status: "QUEUED" }, orderBy: { scheduledAt: "asc" }, select: { scheduledAt: true } }),
      db.extensionDevice.groupBy({ by: ["status"], _count: { _all: true } }),
      db.socialConnection.groupBy({ by: ["status"], _count: { _all: true } }),
      db.automationJob.findFirst({ where: { status: { in: ["COMPLETED", "FAILED"] } }, orderBy: { completedAt: "desc" }, select: { completedAt: true, type: true, status: true } }),
    ]);
    return {
      config,
      runtime: { node: process.version, platform: process.platform, uptimeSec: Math.round(process.uptime()), memoryMb: Math.round(process.memoryUsage().rss / 1_048_576), nodeEnv: env.NODE_ENV, appUrl: env.APP_URL, jobRunnerMode: env.JOB_RUNNER_MODE, queueDriver: env.QUEUE_DRIVER, logLevel: env.LOG_LEVEL },
      database: { ok: !dbError, latencyMs: dbLatencyMs, error: dbError, version: dbVersion, sqlMode: dbSqlMode },
      queue: { queued, running, failed24h, oldestQueuedAt: oldestQueued?.scheduledAt ?? null, lastJob },
      providers: {
        aiDefault: platform.ai.configured ? `${platform.ai.provider} (${platform.ai.model ?? "default model"}) · ${platform.ai.origin}` : null,
        apifyDefault: Boolean(platform.apify.token),
        apifyOrigin: platform.apify.origin,
        meta: Boolean(platform.meta.appId && platform.meta.appSecret),
        metaOrigin: platform.meta.origin,
        metaWebhookVerify: Boolean(platform.meta.webhookVerifyToken),
        superAdminBootstrap: Boolean(env.SUPER_ADMIN_EMAILS),
        storageDir: env.STORAGE_DIR,
      },
      devices: devices.map((d) => ({ status: d.status, count: d._count._all })),
      connections: connections.map((c) => ({ status: c.status, count: c._count._all })),
      recentLogs: getRecentLogs(50),
    };
  },
  { superAdminOnly: true },
);
