import { writeAudit } from "@oses/database";
import { BUILT_IN_ADAPTERS, environmentDefinitions } from "@oses/discovery";
import { providerConfigSchema } from "@oses/validation";
import { withApi } from "@/lib/server/api";

/** Provider configuration: organization rows, platform-wide rows and environment defaults, plus the adapter catalogue. */
export const GET = withApi(
  async (ctx) => {
  const rows = await ctx.db.providerConfig.findMany({ where: { OR: [{ organizationId: ctx.organizationId }, { organizationId: null }] }, orderBy: [{ domain: "asc" }, { platform: "asc" }, { priority: "asc" }] });
  return {
    items: rows.map((r) => ({ ...r, costLimitUsd: r.costLimitUsd ? Number(r.costLimitUsd) : null, scope: r.organizationId ? "organization" : "global" })),
    environmentDefaults: environmentDefinitions(),
    adapters: [...Object.values(BUILT_IN_ADAPTERS).map((a) => ({ key: a.key, platform: a.platform, purposes: a.purposes, defaultActorId: a.defaultActorId, description: a.description })), { key: "generic", platform: "ANY", purposes: ["DISCOVERY", "PROFILE", "CONTENT"], defaultActorId: "", description: "Any Actor with an operator-defined input template (settings.inputTemplate)" }, { key: "generic-dm", platform: "ANY", purposes: ["MESSAGING"], defaultActorId: "", description: "Instagram/Facebook DM Actor with an input template ({{username}}, {{message}}, {{threadUrl}})" }],
  };
  },
  { superAdminOnly: true, operatorOrgOverride: true },
);

export const POST = withApi(
  async (ctx) => {
    const item = await ctx.db.providerConfig.create({ data: { organizationId: ctx.organizationId, domain: ctx.body.domain, provider: ctx.body.provider, platform: ctx.body.platform, actorId: ctx.body.actorId, adapter: ctx.body.adapter, enabled: ctx.body.enabled, priority: ctx.body.priority, costLimitUsd: ctx.body.costLimitUsd ?? null, timeoutSec: ctx.body.timeoutSec, settings: ctx.body.settings as object } });
    await writeAudit(ctx.db, { organizationId: ctx.organizationId, userId: ctx.userId, action: "provider.created", entityType: "ProviderConfig", entityId: item.id, meta: { domain: item.domain, platform: item.platform, actorId: item.actorId } });
    return { item };
  },
  { body: providerConfigSchema, superAdminOnly: true, operatorOrgOverride: true },
);
