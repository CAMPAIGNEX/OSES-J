import { writeAudit } from "@oses/database";
import { NotFoundError } from "@oses/shared";
import { providerConfigSchema } from "@oses/validation";
import { withApi } from "@/lib/server/api";

export const PATCH = withApi(
  async (ctx) => {
    const existing = await ctx.db.providerConfig.findFirst({ where: { id: ctx.params.id ?? "", organizationId: ctx.organizationId } });
    if (!existing) throw new NotFoundError("Provider configuration");
    const b = ctx.body;
    const item = await ctx.db.providerConfig.update({ where: { id: existing.id }, data: { ...(b.domain ? { domain: b.domain } : {}), ...(b.platform ? { platform: b.platform } : {}), ...(b.actorId ? { actorId: b.actorId } : {}), ...(b.adapter ? { adapter: b.adapter } : {}), ...(b.enabled !== undefined ? { enabled: b.enabled } : {}), ...(b.priority !== undefined ? { priority: b.priority } : {}), ...(b.costLimitUsd !== undefined ? { costLimitUsd: b.costLimitUsd } : {}), ...(b.timeoutSec !== undefined ? { timeoutSec: b.timeoutSec } : {}), ...(b.settings !== undefined ? { settings: b.settings as object } : {}) } });
    await writeAudit(ctx.db, { organizationId: ctx.organizationId, userId: ctx.userId, action: "provider.updated", entityType: "ProviderConfig", entityId: item.id });
    return { item };
  },
  { body: providerConfigSchema.partial(), adminOnly: true },
);

export const DELETE = withApi(
  async (ctx) => {
    const res = await ctx.db.providerConfig.deleteMany({ where: { id: ctx.params.id ?? "", organizationId: ctx.organizationId } });
    if (!res.count) throw new NotFoundError("Provider configuration");
    await writeAudit(ctx.db, { organizationId: ctx.organizationId, userId: ctx.userId, action: "provider.deleted", entityType: "ProviderConfig", entityId: ctx.params.id });
    return { ok: true };
  },
  { adminOnly: true },
);
