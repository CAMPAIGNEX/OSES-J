import { getPlatformConfig } from "@oses/database";
import { connectionSummary } from "@oses/messaging";
import { withApi } from "@/lib/server/api";

export const GET = withApi(async (ctx) => {
  const [rows, platform] = await Promise.all([ctx.db.socialConnection.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { createdAt: "desc" } }), getPlatformConfig(ctx.db)]);
  return { items: rows.map(connectionSummary), metaConfigured: Boolean(platform.meta.appId && platform.meta.appSecret), webhookConfigured: Boolean(platform.meta.webhookVerifyToken) };
});
