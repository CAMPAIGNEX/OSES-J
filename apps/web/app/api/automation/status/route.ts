import { getJobQueue } from "@oses/automation";
import { getOrCreateSettings } from "@oses/database";
import { resolveApifyToken } from "@oses/discovery";
import { listDevices } from "@oses/messaging";
import { getEnv, maskSecret } from "@oses/shared";
import { withApi } from "@/lib/server/api";

export const GET = withApi(async (ctx) => {
  const env = getEnv();
  const [settings, devices, counts, apify, messageJobs, providerConfigs] = await Promise.all([
    getOrCreateSettings(ctx.db, ctx.organizationId),
    listDevices(ctx.db, ctx.organizationId),
    getJobQueue(ctx.db).countByStatus(ctx.organizationId),
    resolveApifyToken(ctx.db, ctx.organizationId),
    ctx.db.messageJob.groupBy({ by: ["status"], where: { organizationId: ctx.organizationId }, _count: { _all: true } }),
    ctx.db.providerConfig.count({ where: { OR: [{ organizationId: ctx.organizationId }, { organizationId: null }], enabled: true } }),
  ]);
  return {
    mode: env.JOB_RUNNER_MODE,
    queueDriver: env.QUEUE_DRIVER,
    jobs: counts,
    messageJobs: Object.fromEntries(messageJobs.map((m) => [m.status, m._count._all])),
    extension: { enabled: settings.extensionEnabled, devices, online: devices.some((d) => d.status === "ONLINE") },
    apify: { configured: Boolean(apify.token), origin: apify.origin, tokenPreview: apify.token ? maskSecret(apify.token) : null, enabled: settings.apifyEnabled, providerConfigs },
    ai: { provider: settings.aiProvider ?? (env.AI_PROVIDER !== "none" && env.AI_API_KEY ? `${env.AI_PROVIDER} (platform default)` : null), model: settings.aiModel ?? env.AI_MODEL ?? null, configured: Boolean(settings.aiApiKeyEncrypted) || Boolean(env.AI_PROVIDER !== "none" && env.AI_API_KEY) },
    limits: { maxConcurrentJobs: settings.maxConcurrentJobs, maxRetries: settings.maxRetries, jobTimeoutSec: settings.jobTimeoutSec, preferredProvider: settings.preferredProvider },
  };
});
