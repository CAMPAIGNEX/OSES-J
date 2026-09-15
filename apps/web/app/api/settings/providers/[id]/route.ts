import { writeAudit } from "@oses/database";
import { NotFoundError } from "@oses/shared";
import { providerConfigSchema } from "@oses/validation";
import { withApi } from "@/lib/server/api";
import { providerScope } from "@/lib/server/providers";

export const PATCH = withApi(
  async (ctx) => {
    const organizationId = providerScope(ctx);
    const existing = await ctx.db.providerConfig.findFirst({ where: { id: ctx.params.id ?? "", organizationId } });
    if (!existing) throw new NotFoundError("Provider configuration");
    const b = ctx.body;
    const item = await ctx.db.providerConfig.update({ where: { id: existing.id }, data: { ...(b.domain ? { domain: b.domain } : {}), ...(b.platform ? { platform: b.platform } : {}), ...(b.actorId ? { actorId: b.actorId } : {}), ...(b.adapter ? { adapter: b.adapter } : {}), ...(b.enabled !== undefined ? { enabled: b.enabled } : {}), ...(b.priority !== undefined ? { priority: b.priority } : {}), ...(b.costLimitUsd !== undefined ? { costLimitUsd: b.costLimitUsd } : {}), ...(b.timeoutSec !== undefined ? { timeoutSec: b.timeoutSec } : {}), ...(b.settings !== undefined ? { settings: b.settings as object } : {}) } });
    await writeAudit(ctx.db, { organizationId, userId: ctx.userId, action: "provider.updated", entityType: "ProviderConfig", entityId: item.id, meta: { scope: organizationId ? "organization" : "platform", operator: ctx.session.user.email } });
    return { item };
  },
  { body: providerConfigSchema.partial(), superAdminOnly: true, operatorOrgOverride: true },
);

export const DELETE = withApi(
  async (ctx) => {
    const organizationId = providerScope(ctx);
    const res = await ctx.db.providerConfig.deleteMany({ where: { id: ctx.params.id ?? "", organizationId } });
    if (!res.count) throw new NotFoundError("Provider configuration");
    await writeAudit(ctx.db, { organizationId, userId: ctx.userId, action: "provider.deleted", entityType: "ProviderConfig", entityId: ctx.params.id, meta: { scope: organizationId ? "organization" : "platform", operator: ctx.session.user.email } });
    return { ok: true };
  },
  { superAdminOnly: true, operatorOrgOverride: true },
);
