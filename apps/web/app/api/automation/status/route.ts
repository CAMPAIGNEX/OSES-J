import { getJobQueue } from "@oses/automation";
import { getOrCreateSettings, getPlatformConfig } from "@oses/database";
import { loadProviderDefinitions, resolveApifyToken } from "@oses/discovery";
import { listDevices } from "@oses/messaging";
import { getEnv, maskSecret } from "@oses/shared";
import { withApi } from "@/lib/server/api";

export const GET = withApi(async (ctx) => {
  const env = getEnv();
  const [settings, devices, counts, apify, messageJobs, definitions, platform] = await Promise.all([
    getOrCreateSettings(ctx.db, ctx.organizationId),
    listDevices(ctx.db, ctx.organizationId),
    getJobQueue(ctx.db).countByStatus(ctx.organizationId),
    resolveApifyToken(ctx.db, ctx.organizationId),
    ctx.db.messageJob.groupBy({ by: ["status"], where: { organizationId: ctx.organizationId }, _count: { _all: true } }),
    loadProviderDefinitions(ctx.db, ctx.organizationId),
    getPlatformConfig(ctx.db),
  ]);
  const operator = ctx.isOperator;
  const providerConfigs = definitions.filter((d) => d.domain === "DISCOVERY").length;
  const platformAI = platform.ai.provider !== "none" && platform.ai.apiKey ? `${platform.ai.provider} (platform default)` : null;
  // Members see readiness only; provider details, previews and job limits are operator information (OS-Panel).
  return {
    mode: operator ? env.JOB_RUNNER_MODE : undefined,
    queueDriver: operator ? env.QUEUE_DRIVER : undefined,
    jobs: counts,
    messageJobs: Object.fromEntries(messageJobs.map((m) => [m.status, m._count._all])),
    extension: { enabled: settings.extensionEnabled, devices, online: devices.some((d) => d.status === "ONLINE") },
    apify: { configured: Boolean(apify.token) && settings.apifyEnabled && providerConfigs > 0, enabled: settings.apifyEnabled, origin: operator ? apify.origin : undefined, tokenPreview: operator && apify.token ? maskSecret(apify.token) : null, providerConfigs },
    ai: { provider: operator ? (settings.aiProvider ?? platformAI) : undefined, model: operator ? (settings.aiModel ?? platform.ai.model) : undefined, configured: Boolean(settings.aiApiKeyEncrypted) || (settings.aiProvider !== "none" && platformAI !== null) },
    limits: operator ? { maxConcurrentJobs: settings.maxConcurrentJobs, maxRetries: settings.maxRetries, jobTimeoutSec: settings.jobTimeoutSec, preferredProvider: settings.preferredProvider } : undefined,
  };
}, { operatorOrgOverride: true });
