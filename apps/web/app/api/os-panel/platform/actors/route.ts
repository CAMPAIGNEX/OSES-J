import { recommendedProviderRows } from "@oses/discovery";
import { withApi } from "@/lib/server/api";
import { osAudit } from "@/lib/server/os-panel";

/**
 * Seed the recommended platform-wide Actor rows (organizationId = null). Slots that already have a
 * platform row for the same domain + platform + adapter are left untouched, so this is safe to repeat.
 */
export const POST = withApi(
  async (ctx) => {
    const existing = await ctx.db.providerConfig.findMany({ where: { organizationId: null, provider: "apify" }, select: { domain: true, platform: true, adapter: true } });
    const have = new Set(existing.map((r) => `${r.domain}:${r.platform}:${r.adapter}`));
    const missing = recommendedProviderRows().filter((r) => !have.has(`${r.domain}:${r.platform}:${r.adapter}`));
    if (missing.length) {
      await ctx.db.providerConfig.createMany({ data: missing.map((r) => ({ organizationId: null, domain: r.domain, provider: "apify", platform: r.platform, actorId: r.actorId, adapter: r.adapter, enabled: true, priority: r.priority, timeoutSec: 600, settings: {} })) });
      await osAudit(ctx, { action: "platform.actors_seeded", entityType: "ProviderConfig", meta: { created: missing.map((r) => `${r.domain}:${r.platform}:${r.adapter}`) } });
    }
    return { created: missing.length, skipped: recommendedProviderRows().length - missing.length };
  },
  { superAdminOnly: true },
);
