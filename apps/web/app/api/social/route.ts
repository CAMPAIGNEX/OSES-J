import { connectionSummary } from "@oses/messaging";
import { getEnv } from "@oses/shared";
import { withApi } from "@/lib/server/api";

export const GET = withApi(async (ctx) => {
  const env = getEnv();
  const rows = await ctx.db.socialConnection.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { createdAt: "desc" } });
  return { items: rows.map(connectionSummary), metaConfigured: Boolean(env.META_APP_ID && env.META_APP_SECRET), webhookConfigured: Boolean(env.META_WEBHOOK_VERIFY_TOKEN) };
});
