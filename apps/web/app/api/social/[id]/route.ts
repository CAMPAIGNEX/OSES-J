import { disconnectSocialConnection } from "@oses/messaging";
import { withApi } from "@/lib/server/api";

export const DELETE = withApi(async (ctx) => {
  await disconnectSocialConnection(ctx.db, ctx.organizationId, ctx.userId, ctx.params.id ?? "");
  return { ok: true };
});
