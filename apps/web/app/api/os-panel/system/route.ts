import { checkEnv, getEnv } from "@oses/shared";
import { withApi } from "@/lib/server/api";

/** Platform health for operators: configuration (names only), runtime, queue depth and provider defaults. */
export const GET = withApi(
  async ({ db }) => {
    const env = getEnv();
    const config = checkEnv();
    const started = Date.now();
    let dbLatencyMs: number | null = null;
    let dbError: string | null = null;
    try {
      await db.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - started;
    } catch (err) {
      dbError = (err as Error).message;
    }
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
      database: { ok: !dbError, latencyMs: dbLatencyMs, error: dbError },
      queue: { queued, running, failed24h, oldestQueuedAt: oldestQueued?.scheduledAt ?? null, lastJob },
      providers: {
        aiDefault: env.AI_PROVIDER !== "none" && Boolean(env.AI_API_KEY) ? `${env.AI_PROVIDER} (${env.AI_MODEL ?? "default model"})` : null,
        apifyDefault: Boolean(env.APIFY_API_TOKEN),
        meta: Boolean(env.META_APP_ID && env.META_APP_SECRET),
        metaWebhookVerify: Boolean(env.META_WEBHOOK_VERIFY_TOKEN),
        superAdminBootstrap: Boolean(env.SUPER_ADMIN_EMAILS),
        storageDir: env.STORAGE_DIR,
      },
      devices: devices.map((d) => ({ status: d.status, count: d._count._all })),
      connections: connections.map((c) => ({ status: c.status, count: c._count._all })),
    };
  },
  { superAdminOnly: true },
);
