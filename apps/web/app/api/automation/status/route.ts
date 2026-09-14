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
  const operator = ctx.isOperator;
  // Members see readiness only; provider details, previews and job limits are operator information (OS-Panel).
  return {
    mode: operator ? env.JOB_RUNNER_MODE : undefined,
    queueDriver: operator ? env.QUEUE_DRIVER : undefined,
    jobs: counts,
    messageJobs: Object.fromEntries(messageJobs.map((m) => [m.status, m._count._all])),
    extension: { enabled: settings.extensionEnabled, devices, online: devices.some((d) => d.status === "ONLINE") },
    apify: { configured: Boolean(apify.token) && settings.apifyEnabled && providerConfigs > 0, enabled: settings.apifyEnabled, origin: operator ? apify.origin : undefined, tokenPreview: operator && apify.token ? maskSecret(apify.token) : null, providerConfigs },
    ai: { provider: operator ? (settings.aiProvider ?? (env.AI_PROVIDER !== "none" && env.AI_API_KEY ? `${env.AI_PROVIDER} (platform default)` : null)) : undefined, model: operator ? (settings.aiModel ?? env.AI_MODEL ?? null) : undefined, configured: Boolean(settings.aiApiKeyEncrypted) || Boolean(env.AI_PROVIDER !== "none" && env.AI_API_KEY) },
    limits: operator ? { maxConcurrentJobs: settings.maxConcurrentJobs, maxRetries: settings.maxRetries, jobTimeoutSec: settings.jobTimeoutSec, preferredProvider: settings.preferredProvider } : undefined,
  };
}, { operatorOrgOverride: true });
