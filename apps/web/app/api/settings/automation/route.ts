import { getOrCreateSettings, writeAudit } from "@oses/database";
import { encryptSecret, ForbiddenError, getEnv } from "@oses/shared";
import { automationSettingsSchema } from "@oses/validation";
import { withApi } from "@/lib/server/api";

export const PUT = withApi(
  async (ctx) => {
    const env = getEnv();
    await getOrCreateSettings(ctx.db, ctx.organizationId);
    const b = ctx.body;
    // Operations settings (provider keys, job limits) are managed by platform operators from the OS-Panel only.
    const operatorOnlyKeys = ["apifyToken", "apifyEnabled", "maxConcurrentJobs", "maxRetries", "jobTimeoutSec", "preferredProvider"] as const;
    if (!ctx.isOperator && operatorOnlyKeys.some((k) => b[k] !== undefined)) throw new ForbiddenError("These settings are managed by the CNEX AI team. Contact support to change them.");
    const data: Record<string, unknown> = {};
    if (b.apifyToken !== undefined) data.apifyTokenEncrypted = b.apifyToken ? encryptSecret(b.apifyToken, env.ENCRYPTION_KEY) : null;
    if (b.apifyEnabled !== undefined) data.apifyEnabled = b.apifyEnabled;
    if (b.maxConcurrentJobs !== undefined) data.maxConcurrentJobs = b.maxConcurrentJobs;
    if (b.maxRetries !== undefined) data.maxRetries = b.maxRetries;
    if (b.jobTimeoutSec !== undefined) data.jobTimeoutSec = b.jobTimeoutSec;
    if (b.extensionEnabled !== undefined) data.extensionEnabled = b.extensionEnabled;
    if (b.preferredProvider !== undefined) data.preferredProvider = b.preferredProvider;
    await ctx.db.organizationSettings.update({ where: { organizationId: ctx.organizationId }, data });
    await writeAudit(ctx.db, { organizationId: ctx.organizationId, userId: ctx.userId, action: "settings.automation_updated", meta: { fields: Object.keys(data).filter((k) => k !== "apifyTokenEncrypted"), tokenChanged: b.apifyToken !== undefined } });
    return { ok: true };
  },
  { body: automationSettingsSchema, adminOnly: true, operatorOrgOverride: true },
);
